# Notificaciones por Email

La API puede enviar avisos automáticos al empleado cuando un administrador:

1. aprueba una solicitud
2. rechaza una solicitud
3. asigna directamente vacaciones, baja, día libre u horas extra

## Variables de entorno

Configura en `/Users/alberto/Documents/New project/fichar-backend/fichar-backend/api-fichar/.env`:

```env
MAIL_ENABLED="true"
MAIL_FROM="tu_cuenta_notificaciones@gmail.com"
MAIL_FROM_NAME="Fichaje"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="tu_cuenta_notificaciones@gmail.com"
SMTP_PASS="TU_APP_PASSWORD_DE_GOOGLE"
```

## Gmail

Si usas Gmail:

1. activa la verificación en dos pasos
2. crea una contraseña de aplicación en Google
3. usa esa contraseña en `SMTP_PASS`

No uses la contraseña normal de tu cuenta.

## Prueba rápida desde el panel admin

1. entra como administrador
2. ve a `Panel administrador > Correo de prueba`
3. indica un destinatario
4. pulsa `Enviar correo de prueba`

Si el SMTP está bien configurado, la API enviará un mensaje de comprobación sin necesidad de aprobar una solicitud real.

## Comportamiento

1. Si el envío falla, la solicitud sigue aprobada o rechazada igualmente.
2. Si `MAIL_ENABLED="false"`, la API no intenta enviar correos.
3. Si falta configuración SMTP, la API lo registra en logs y continúa sin bloquear la operación principal.
