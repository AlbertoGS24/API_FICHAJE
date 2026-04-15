# Estado Checklist Pre-Entrega (20/03/2026)

Referencia: `docs/checklist-pre-entrega-final.md`

## Cerrado hoy (verificado)

- [x] `.env` con `DATABASE_URL`.
- [x] `.env` con `FIREBASE_WEB_API_KEY`.
- [x] Scripts de backup/restore disponibles en `package.json`.
- [x] Backup ejecutado correctamente.
- [x] Archivos backup presentes en `backups/`.
- [x] Tests backend en verde (`12/12` suites).

Evidencias:

- Backup creado: `backups/fichar-backup-20260320-121838.sql`
- Tests: `npm test -- --runInBand` (pass)

## Pendiente (para cerrar entrega)

- [ ] Activar CAPTCHA en real:
  - [ ] `TURNSTILE_ENABLED=true`
  - [ ] `TURNSTILE_SITE_KEY`
  - [ ] `TURNSTILE_SECRET_KEY`
- [ ] Ejecutar y validar restauracion completa en entorno de pruebas:
  - [ ] `RESTORE_CONFIRM=YES npm run restore:db -- backups/<archivo>.sql`
  - [ ] Login y funcionalidades principales OK tras restaurar
- [ ] Validacion funcional final en UI:
  - [ ] Flujo trabajador (fichaje, solicitudes, firma, descarga)
  - [ ] Flujo admin (usuarios, revisiones con comentario, dashboard, exportes)
  - [ ] Aislamiento multiempresa (A no ve B)
- [ ] Evidencias de entrega:
  - [ ] Capturas finales
  - [ ] Manual admin
  - [ ] Manual trabajador
  - [ ] ZIP final

## Siguiente paso recomendado (rapido)

1. Hacer prueba de restauracion en local de pruebas (10-15 min).
2. Ejecutar demo funcional final con dos cuentas (admin + empleado) y sacar capturas (30-45 min).
3. Redactar manuales con esa evidencia y cerrar ZIP de entrega.
