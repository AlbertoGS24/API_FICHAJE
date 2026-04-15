# Checklist Final Pre-Entrega (API Fichar)

Fecha objetivo de entrega: **23/03/2026**

## 1) Entorno y seguridad base

- [ ] `.env` configurado con `DATABASE_URL` correcto.
- [ ] `FIREBASE_WEB_API_KEY` configurada.
- [ ] CAPTCHA configurado para onboarding publico:
  - [ ] `TURNSTILE_ENABLED=true`
  - [ ] `TURNSTILE_SITE_KEY` definida
  - [ ] `TURNSTILE_SECRET_KEY` definida
- [ ] API arranca sin errores (`npm run start:dev`).
- [ ] `/health` responde OK.

## 2) Datos y backup

- [ ] Backup creado (`npm run backup:db`).
- [ ] Archivo backup presente en carpeta `backups/`.
- [ ] Restauracion probada en entorno de pruebas (no en produccion):
  - [ ] `RESTORE_CONFIRM=YES npm run restore:db -- backups/<archivo>.sql`
  - [ ] Login y endpoints principales siguen funcionando tras restaurar.

## 3) Flujo trabajador (EMPLOYEE / INTERN)

- [ ] Login correcto con Firebase.
- [ ] Fichar entrada:
  - [ ] Guarda hora de inicio.
  - [ ] Captura geolocalizacion automatica.
  - [ ] Aparece contador de tiempo trabajado.
- [ ] Fichar salida:
  - [ ] Guarda hora de fin.
  - [ ] Calcula duracion correctamente.
- [ ] Historial de ultimos fichajes visible en inicio.
- [ ] Solicitudes:
  - [ ] Crear solicitud.
  - [ ] Ver estado y comentario de revision.
  - [ ] Cancelar solicitud si esta en `PENDING`.
- [ ] Documentos:
  - [ ] Crear documento en `DRAFT`.
  - [ ] Firmar con canvas visible.
  - [ ] Descargar solo cuando estado `SIGNED`.

## 4) Flujo administrador

- [ ] Login admin correcto.
- [ ] Dashboard admin carga metricas.
- [ ] Gestion de usuarios:
  - [ ] Alta de usuario nueva.
  - [ ] Cambio de rol/grupo/horas con un solo boton guardar.
  - [ ] Ver perfil de usuario.
  - [ ] Eliminar usuario.
- [ ] Solicitudes admin:
  - [ ] Aprobar y rechazar.
  - [ ] Guardar comentario de revision.
- [ ] Geolocalizacion/antifraude:
  - [ ] Configurar workplace (lat/lng/radio).
  - [ ] Ver listado de fichajes sospechosos.
- [ ] Exportaciones:
  - [ ] Excel empresa correcto.
  - [ ] PDF empleado correcto.

## 5) Aislamiento multiempresa

- [ ] Admin de empresa A no ve usuarios/solicitudes/documentos de empresa B.
- [ ] Usuario trabajador solo ve sus propios datos.
- [ ] Revisar que todas las consultas usan `companyId` del usuario autenticado.

## 6) Evidencias para entrega

- [ ] Capturas de pantalla de cada modulo (trabajador + admin).
- [ ] Manual administrador actualizado.
- [ ] Manual trabajador actualizado.
- [ ] Informe diario/semana generado.
- [ ] ZIP final de entrega preparado.
