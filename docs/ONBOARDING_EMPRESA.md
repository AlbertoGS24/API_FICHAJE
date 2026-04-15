# Alta Inicial De Empresa

## Objetivo

Evitar que cualquier persona pueda registrar una empresa desde la pantalla pública sin validación previa.

## Flujo recomendado

1. El cliente paga o supera la validación comercial.
2. Se genera una clave de activación de un solo uso.
3. El cliente abre la pantalla principal de login.
4. Usa el bloque `Activar nueva empresa (admin)` con:
   - clave de activación
   - email administrador
   - nombre administrador
5. El backend valida:
   - que la clave existe
   - que no está usada
   - que no ha caducado
   - que el email coincide con el autorizado
6. Se crea la empresa y el primer administrador.
7. Se envía email de acceso o se genera enlace manual de contraseña.

## Comando para emitir una clave

```bash
npm run issue:company-key -- \
  --company-cif B12345678 \
  --company-name "Acme S.L." \
  --admin-email admin@acme.com \
  --admin-name "Nombre Apellidos" \
  --expires-days 14
```

Opcional:

```bash
--company-logo-url https://dominio/logo.png
```

## Variables relevantes

- `PUBLIC_COMPANY_SELF_REGISTER_ENABLED="false"`
- `ALLOW_DEFAULT_COMPANY_BOOTSTRAP="false"`
- `TURNSTILE_ENABLED="true"` en internet

## Seguridad aplicada

- Registro público abierto deshabilitado por defecto.
- Claves de activación de un solo uso.
- Caducidad configurable.
- CAPTCHA en onboarding público.
- Rate-limit en onboarding público.
- Los usuarios Firebase ya no se auto-crean en la empresa por defecto salvo que se reactive explícitamente el modo legado.
