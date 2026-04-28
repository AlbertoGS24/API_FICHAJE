const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const ALLOWED_SCOPES = [
  'read:summary',
  'read:requests',
  'read:shifts',
  'read:schedule',
];

function fail(message) {
  console.error(`[issue:openclaw-token] ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

function buildToken() {
  return `ocla_${crypto.randomBytes(32).toString('base64url')}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function previewToken(token) {
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
}

function parseScopes(raw) {
  if (!raw) return ALLOWED_SCOPES;
  const scopes = [...new Set(String(raw).split(',').map((scope) => scope.trim()).filter(Boolean))];
  const invalid = scopes.filter((scope) => !ALLOWED_SCOPES.includes(scope));
  if (invalid.length) {
    fail(`Scopes inválidos: ${invalid.join(', ')}. Permitidos: ${ALLOWED_SCOPES.join(', ')}`);
  }
  return scopes;
}

function createPrisma() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) fail('DATABASE_URL no esta definida en .env');

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return { prisma, pool };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const companyCode = String(args['company-code'] || '').trim();
  const companyId = String(args['company-id'] || '').trim();
  const scopes = parseScopes(args.scopes);

  if (!companyCode && !companyId) {
    fail(
      'Uso: npm run issue:openclaw-token -- --company-code DEFAULT [--scopes read:summary,read:requests,read:shifts,read:schedule]',
    );
  }

  const { prisma, pool } = createPrisma();
  try {
    const company = await prisma.company.findFirst({
      where: companyId ? { id: companyId } : { code: companyCode },
      select: { id: true, code: true, name: true, isActive: true },
    });

    if (!company) fail('Empresa no encontrada');
    if (!company.isActive) fail('La empresa existe, pero está desactivada');

    const token = buildToken();
    const integration = await prisma.agentIntegration.upsert({
      where: {
        companyId_provider: {
          companyId: company.id,
          provider: 'OPENCLAW',
        },
      },
      update: {
        isEnabled: true,
        tokenHash: hashToken(token),
        tokenPreview: previewToken(token),
        scopes,
      },
      create: {
        companyId: company.id,
        provider: 'OPENCLAW',
        isEnabled: true,
        tokenHash: hashToken(token),
        tokenPreview: previewToken(token),
        scopes,
      },
      select: {
        id: true,
        tokenPreview: true,
        scopes: true,
      },
    });

    console.log('[issue:openclaw-token] Token OpenClaw creado correctamente');
    console.log(`Empresa: ${company.name} (${company.code})`);
    console.log(`Integración: ${integration.id}`);
    console.log(`Token preview: ${integration.tokenPreview}`);
    console.log(`Permisos: ${integration.scopes.join(', ')}`);
    console.log('');
    console.log('TOKEN_COMPLETO:');
    console.log(token);
    console.log('');
    console.log('Guarda este token ahora. La base de datos solo conserva su hash.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Error inesperado');
});
