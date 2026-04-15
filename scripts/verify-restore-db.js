const { Client } = require('pg');
require('dotenv').config();

function fail(message) {
  console.error(`[verify:restore:db] ERROR: ${message}`);
  process.exit(1);
}

async function run() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    fail('DATABASE_URL no esta definida en .env');
  }

  const requiredTables = [
    '_prisma_migrations',
    'Company',
    'User',
    'Shift',
    'Request',
    'Document',
    'Workplace',
    'Holiday',
  ];

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    const tablesResult = await client.query(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
      `,
    );

    const existingTables = new Set(
      tablesResult.rows.map((row) => String(row.tablename)),
    );
    const missingTables = requiredTables.filter(
      (name) => !existingTables.has(name),
    );

    if (missingTables.length) {
      fail(`Faltan tablas tras la restauracion: ${missingTables.join(', ')}`);
    }

    const migrationsResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM "public"."_prisma_migrations"',
    );
    const companiesResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM "public"."Company"',
    );
    const usersResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM "public"."User"',
    );

    console.log('[verify:restore:db] OK esquema principal detectado.');
    console.log(
      `[verify:restore:db] Migraciones registradas: ${migrationsResult.rows[0]?.count ?? 0}`,
    );
    console.log(
      `[verify:restore:db] Empresas: ${companiesResult.rows[0]?.count ?? 0}`,
    );
    console.log(
      `[verify:restore:db] Usuarios: ${usersResult.rows[0]?.count ?? 0}`,
    );
    console.log(
      '[verify:restore:db] Restauracion validada a nivel de base de datos.',
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error desconocido';
    fail(message);
  } finally {
    await client.end().catch(() => undefined);
  }
}

run();
