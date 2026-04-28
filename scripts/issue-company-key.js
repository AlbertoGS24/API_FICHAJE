const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

function fail(message) {
  console.error(`[issue:company-key] ERROR: ${message}`);
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

function normalizeCompanyCif(rawCif) {
  return String(rawCif || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function isValidSpanishCif(cif) {
  if (!/^[A-Z]\d{7}[0-9A-Z]$/.test(cif)) return false;

  const letter = cif[0];
  const digits = cif.slice(1, 8);
  const control = cif[8];

  let sumEven = 0;
  let sumOdd = 0;

  for (let i = 0; i < digits.length; i += 1) {
    const n = Number(digits[i]);
    const position = i + 1;
    if (position % 2 === 0) {
      sumEven += n;
    } else {
      const doubled = n * 2;
      sumOdd += Math.floor(doubled / 10) + (doubled % 10);
    }
  }

  const total = sumEven + sumOdd;
  const controlDigit = (10 - (total % 10)) % 10;
  const controlDigitChar = String(controlDigit);
  const controlLetterChar = 'JABCDEFGHI'[controlDigit];

  if ('ABEH'.includes(letter)) return control === controlDigitChar;
  if ('KPQS'.includes(letter)) return control === controlLetterChar;
  return control === controlDigitChar || control === controlLetterChar;
}

function normalizeEmail(rawEmail) {
  return String(rawEmail || '').trim().toLowerCase();
}

function buildActivationKey() {
  const p1 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const p2 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const p3 = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `ACT-${p1}-${p2}-${p3}`;
}

function normalizeActivationKey(rawKey) {
  return String(rawKey || '').trim().toUpperCase().replace(/\s+/g, '');
}

function hashActivationKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function parsePositiveInt(value, fallback) {
  const n = Number(value ?? '');
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

function createPrisma() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) fail('DATABASE_URL no está definida en .env');

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return { prisma, pool };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const companyCif = normalizeCompanyCif(args['company-cif']);
  const companyName = String(args['company-name'] || '').trim();
  const adminEmail = normalizeEmail(args['admin-email']);
  const adminName = String(args['admin-name'] || '').trim();
  const companyLogoUrl = String(args['company-logo-url'] || '').trim() || null;
  const expiresInDays = parsePositiveInt(args['expires-days'], 14);

  if (!companyCif || !companyName || !adminEmail || !adminName) {
    fail(
      'Uso: npm run issue:company-key -- --company-cif B12345678 --company-name "Acme S.L." --admin-email admin@acme.com --admin-name "Nombre Apellidos" [--expires-days 14] [--company-logo-url https://...]',
    );
  }

  if (!isValidSpanishCif(companyCif)) {
    fail('CIF inválido');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adminEmail)) {
    fail('Email inválido');
  }

  const { prisma, pool } = createPrisma();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + expiresInDays);

  try {
    const [existingCompany, existingActiveKey] = await Promise.all([
      prisma.company.findUnique({
        where: { code: companyCif },
        select: { id: true },
      }),
      prisma.adminActivationKey.findFirst({
        where: {
          companyCode: companyCif,
          usedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true, expiresAt: true },
      }),
    ]);

    if (existingCompany) {
      fail('Ya existe una empresa activa con ese CIF');
    }

    if (existingActiveKey) {
      fail('Ya existe una clave de activación activa para ese CIF');
    }

    const activationKey = buildActivationKey();
    const keyHash = hashActivationKey(
      normalizeActivationKey(activationKey),
    );

    await prisma.adminActivationKey.create({
      data: {
        keyHash,
        companyCode: companyCif,
        companyName,
        companyLogoUrl,
        adminEmail,
        adminName,
        expiresAt,
      },
    });

    console.log('[issue:company-key] Clave creada correctamente');
    console.log(`Empresa CIF: ${companyCif}`);
    console.log(`Empresa nombre: ${companyName}`);
    console.log(`Admin email: ${adminEmail}`);
    console.log(`Admin nombre: ${adminName}`);
    console.log(`Caduca: ${expiresAt.toISOString()}`);
    console.log(`Clave de activación: ${activationKey}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : 'Error inesperado');
});
