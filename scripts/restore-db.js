const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config();

function fail(message) {
  console.error(`[restore:db] ERROR: ${message}`);
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

function ensureCommand(name) {
  const probe = spawnSync('which', [name], { encoding: 'utf8' });
  if (probe.status !== 0) {
    fail(
      `No se encontro "${name}" en el sistema. Instala cliente PostgreSQL (pg_dump/psql).`,
    );
  }
}

function resolveInputFile() {
  const raw = (process.argv[2] || '').trim();
  if (!raw) {
    fail(
      'Debes indicar el archivo .sql. Uso: npm run restore:db -- backups/fichar-backup-YYYYMMDD-HHMMSS.sql',
    );
  }
  const absolute = path.resolve(process.cwd(), raw);
  if (!fs.existsSync(absolute)) {
    fail(`No existe el archivo: ${absolute}`);
  }
  return absolute;
}

function runPsql(databaseUrl, args) {
  const result = spawnSync(
    'psql',
    ['--dbname', databaseUrl, '--set', 'ON_ERROR_STOP=1', ...args],
    {
      stdio: 'inherit',
      env: process.env,
    },
  );
  if (result.status !== 0) {
    fail('Fallo comando psql');
  }
}

const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
  fail('DATABASE_URL no esta definida en .env');
}

addPgToolsToPathIfNeeded();
ensureCommand('psql');

const sqlFile = resolveInputFile();
const confirmed = (process.env.RESTORE_CONFIRM || '').trim().toUpperCase();
if (confirmed !== 'YES') {
  fail(
    'Operacion destructiva bloqueada. Ejecuta con RESTORE_CONFIRM=YES para continuar.',
  );
}

console.log(`[restore:db] Restaurando desde ${sqlFile}`);
console.log('[restore:db] Reiniciando schema public...');
runPsql(databaseUrl, ['--command', 'DROP SCHEMA IF EXISTS public CASCADE;']);
runPsql(databaseUrl, ['--command', 'CREATE SCHEMA public;']);

console.log('[restore:db] Cargando backup...');
runPsql(databaseUrl, ['--file', sqlFile]);

console.log('[restore:db] OK restauracion completada.');
