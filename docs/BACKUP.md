# Backup y Restauracion (PostgreSQL)

## Requisitos

- Tener `DATABASE_URL` en `.env`.
- Tener cliente PostgreSQL instalado (`pg_dump` y `psql`).

Instalacion rapida en macOS (Homebrew):

```bash
brew install libpq
brew link --force libpq
```

## 1) Crear backup

Comando:

```bash
npm run backup:db
```

Resultado:

- Se crea archivo SQL en carpeta `backups/` con nombre tipo:
  `fichar-backup-20260320-120000.sql`

Opcional (cambiar carpeta destino):

```bash
npm run backup:db -- ./mis-backups
```

## 2) Restaurar backup

Aviso:

- Esta accion borra y recrea el schema `public` antes de restaurar.

Comando:

```bash
RESTORE_CONFIRM=YES npm run restore:db -- backups/fichar-backup-YYYYMMDD-HHMMSS.sql
```

## 3) Verificacion rapida tras restaurar

1. Validar la base restaurada:

```bash
npm run verify:restore:db
```

2. Levantar API:

```bash
npm run start:dev
```

3. Comprobar health:

```bash
curl http://localhost:3000/health
```

4. Entrar en la app y validar login + datos principales.

## 4) Backup desde panel administrador

- Boton en frontend admin: `Crear backup ahora`.
- Endpoint backend admin:
  - `POST /admin/system/backup`
  - `GET /admin/system/backup-status`

## 5) Backup automatico cada 24h

Variables:

```bash
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=30
```

Opcional:

```bash
BACKUP_DIR=backups
```

## Recomendacion operativa

- Hacer backup diario automatico.
- Guardar copia fuera del servidor principal (otra maquina o bucket seguro).
- Probar restauracion al menos 1 vez al mes.
