import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createHash } from 'crypto';
import express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

type RateLimitOptions = {
  scope: string;
  windowMs: number;
  max: number;
  keyGenerator?: (req: express.Request) => string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

function toIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function parseAllowedOrigins() {
  const raw =
    process.env.CORS_ORIGIN_ALLOWLIST ?? process.env.CORS_ORIGINS ?? '';
  const origins = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return new Set(origins);
}

function getClientIp(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getBearerTokenFingerprint(req: express.Request) {
  const authHeader = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const token = match?.[1]?.trim();
  if (!token) return `ip:${getClientIp(req)}`;
  const fingerprint = createHash('sha256').update(token).digest('hex');
  return `token:${fingerprint.slice(0, 24)}`;
}

function createRateLimiter(options: RateLimitOptions): express.RequestHandler {
  const buckets = new Map<string, RateLimitBucket>();
  let requestCount = 0;

  return (req, res, next) => {
    const now = Date.now();
    requestCount += 1;

    // Limpieza ligera periódica para evitar crecimiento infinito de memoria.
    if (requestCount % 200 === 0) {
      for (const [key, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
    }

    const keyPart = options.keyGenerator
      ? options.keyGenerator(req)
      : getClientIp(req);
    const key = `${options.scope}:${keyPart}`;
    const current = buckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(bucket.resetAt / 1000)),
    );

    if (bucket.count > options.max) {
      res.status(429).json({
        message: 'Demasiadas peticiones. Inténtalo de nuevo en unos minutos.',
      });
      return;
    }

    next();
  };
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = parseAllowedOrigins();
  const globalMax = toIntEnv('RATE_LIMIT_GLOBAL_MAX', 180);
  const onboardingMax = toIntEnv('RATE_LIMIT_ONBOARDING_MAX', 12);
  const agentMax = toIntEnv('RATE_LIMIT_AGENT_MAX', 60);

  const app = await NestFactory.create(AppModule);
  const expressInstance = app.getHttpAdapter().getInstance();
  expressInstance.set('trust proxy', 1);
  app.use(express.static(join(process.cwd(), 'public')));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      // Requests sin Origin (server-to-server, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.has(origin)) return callback(null, true);

      if (!isProduction) {
        const isLocalhost =
          /^http:\/\/localhost(?::\d+)?$/i.test(origin) ||
          /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin);
        if (isLocalhost) return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Docs-Key'],
    credentials: true,
  });

  // Cabeceras de seguridad (equivalente básico a helmet, sin dependencia externa).
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(self), microphone=(), camera=()',
    );
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }
    next();
  });

  // Rate-limit global (toda la API) y más estricto en onboarding público.
  app.use(
    createRateLimiter({
      scope: 'global',
      windowMs: 60 * 1000,
      max: globalMax,
    }),
  );
  app.use(
    '/onboarding/self-register-company',
    createRateLimiter({
      scope: 'onboarding-self-register',
      windowMs: 10 * 60 * 1000,
      max: onboardingMax,
    }),
  );
  app.use(
    '/onboarding/activate-admin',
    createRateLimiter({
      scope: 'onboarding-activate-admin',
      windowMs: 10 * 60 * 1000,
      max: onboardingMax,
    }),
  );
  app.use(
    '/agent',
    createRateLimiter({
      scope: 'agent',
      windowMs: 60 * 1000,
      max: agentMax,
      keyGenerator: getBearerTokenFingerprint,
    }),
  );

  const swaggerEnabled =
    !isProduction || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    if (isProduction) {
      app.use(['/docs', '/docs-json'], (req, res, next) => {
        const docsKey = (process.env.DOCS_ACCESS_KEY ?? '').trim();
        if (!docsKey) {
          res.status(503).json({
            message:
              'Swagger deshabilitado: falta DOCS_ACCESS_KEY en producción.',
          });
          return;
        }

        const incomingKey = String(req.header('x-docs-key') ?? '');
        if (incomingKey !== docsKey) {
          res
            .status(401)
            .json({ message: 'No autorizado para acceder a /docs' });
          return;
        }
        next();
      });
    }

    const config = new DocumentBuilder()
      .setTitle('API Fichar')
      .setDescription('API para fichaje, solicitudes, documentos y onboarding')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = toIntEnv('PORT', 3000);
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
