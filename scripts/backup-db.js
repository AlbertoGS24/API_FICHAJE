const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config();

function fail(message) {
  console.error(`[backup:db] ERROR: ${message}`);
  process.exit(1);
}

function addPgToolsToPathIfNeeded() {
  const candidates = [
    '/opt/homebrew/opt/libpq/bin',
    '/usr/local/opt/libpq/bin',
  ];
  const currentPath = process.env.PATH || '';
  const existing = currentPath.split(':');

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    if (existing.includes(dir)) continue;
    process.env.PATH = `${dir}:${process.env.PATH || ''}`;
  }
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function parsePositiveInt(value, fallback) {
  const n = Number(value ?? '');
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

function ensureCommand(name) {
  const probe = spawnSync('which', [name], { encoding: 'utf8' });
  if (probe.status !== 0) {
    fail(
      `No se encontro "${name}" en el sistema. Instala cliente PostgreSQL (pg_dump/psql).`,
    );
  }
}

function pruneOldBackups(directory, retentionDays) {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const deleted = [];

  const files = fs
    .readdirSync(directory)
    .filter((name) => /^fichar-backup-\d{8}-\d{6}\.sql$/.test(name));

  for (const name of files) {
    const filePath = path.join(directory, name);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs >= cutoffMs) continue;
    fs.unlinkSync(filePath);
    deleted.push(name);
  }

  return deleted;
}

const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
  fail('DATABASE_URL no esta definida en .env');
}

addPgToolsToPathIfNeeded();
ensureCommand('pg_dump');

const outputDirRaw = process.argv[2] || process.env.BACKUP_DIR || 'backups';
const outputDir = path.resolve(process.cwd(), outputDirRaw);
fs.mkdirSync(outputDir, { recursive: true });
const retentionDays = parsePositiveInt(process.env.BACKUP_RETENTION_DAYS, 30);

const outputFile = path.join(outputDir, `fichar-backup-${nowStamp()}.sql`);

const dumpArgs = [
  '--dbname',
  databaseUrl,
  '--format=plain',
  '--encoding=UTF8',
  '--no-owner',
  '--no-privileges',
  '--file',
  outputFile,
];

console.log('[backup:db] Generando backup...');
const result = spawnSync('pg_dump', dumpArgs, {
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  fail('Fallo pg_dump');
}

const stat = fs.statSync(outputFile);
console.log(`[backup:db] OK -> ${outputFile} (${stat.size} bytes)`);

const deleted = pruneOldBackups(outputDir, retentionDays);
if (deleted.length > 0) {
  console.log(
    `[backup:db] Limpieza aplicada: ${deleted.length} backup(s) eliminados (> ${retentionDays} días).`,
  );
}
