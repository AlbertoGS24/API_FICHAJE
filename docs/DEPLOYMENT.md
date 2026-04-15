# Despliegue Profesional

## Objetivo

Dejar la aplicación lista para uso real con:

- API NestJS en producción
- PostgreSQL persistente
- HTTPS
- backups automáticos
- SMTP y Firebase configurados

## Arquitectura recomendada

1. Servidor Linux para la API (`Ubuntu 24.04 LTS` por ejemplo)
2. PostgreSQL en servidor o servicio separado
3. `Nginx` como proxy inverso con HTTPS
4. Dominio real (`app.tuempresa.com`)
5. Copias de seguridad diarias guardadas también fuera del servidor principal

## Requisitos previos

- Node.js `22`
- PostgreSQL `16` o superior
- dominio apuntando al servidor
- credenciales reales de:
  - Firebase
  - SMTP
  - Turnstile

## 1) Preparar el servidor

Instalar dependencias base:

```bash
sudo apt update
sudo apt install -y nginx postgresql-client
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2) Subir el proyecto

Copiar el proyecto al servidor, por ejemplo:

```bash
/var/www/api-fichar
```

Dentro del proyecto:

```bash
npm install
npx prisma generate
npm run build
```

## 3) Configurar variables de entorno

Crear un `.env` de producción con valores reales:

```env
NODE_ENV="production"
PORT="3000"
DATABASE_URL="postgresql://usuario:password@host:5432/fichar"
FIREBASE_PROJECT_ID="..."
FIREBASE_CLIENT_EMAIL="..."
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_WEB_API_KEY="..."
TURNSTILE_ENABLED="true"
TURNSTILE_SITE_KEY="..."
TURNSTILE_SECRET_KEY="..."
MAIL_ENABLED="true"
MAIL_FROM="notificaciones@tuempresa.com"
MAIL_FROM_NAME="Fichaje"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="notificaciones@tuempresa.com"
SMTP_PASS="TU_APP_PASSWORD"
GEO_REVERSE_GEOCODE_ENABLED="true"
GEO_REVERSE_GEOCODE_URL="https://nominatim.openstreetmap.org/reverse"
DEFAULT_VACATION_ALLOWANCE_DAYS="22"
AUTO_BACKUP_ENABLED="true"
AUTO_BACKUP_INTERVAL_HOURS="24"
BACKUP_RETENTION_DAYS="30"
```

## 4) Aplicar base de datos

Antes del primer arranque:

```bash
npx prisma migrate deploy
```

Si se restaura un backup SQL:

```bash
RESTORE_CONFIRM=YES npm run restore:db -- backups/tu-backup.sql
npm run verify:restore:db
```

## 5) Arrancar como servicio

Crear `/etc/systemd/system/api-fichar.service`:

```ini
[Unit]
Description=API Fichar
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/api-fichar
ExecStart=/usr/bin/npm run start:prod
Restart=always
RestartSec=5
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Activar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable api-fichar
sudo systemctl start api-fichar
sudo systemctl status api-fichar
```

## 6) Configurar Nginx

Ejemplo básico:

```nginx
server {
  listen 80;
  server_name app.tuempresa.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Activar sitio:

```bash
sudo ln -s /etc/nginx/sites-available/api-fichar /etc/nginx/sites-enabled/api-fichar
sudo nginx -t
sudo systemctl reload nginx
```

## 7) Activar HTTPS

Con Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.tuempresa.com
```

## 8) Comprobaciones finales

1. `https://app.tuempresa.com/health`
2. login con admin
3. fichaje entrada/salida
4. creación y revisión de solicitudes
5. cuadrante y festivos
6. backup manual desde panel admin
7. correo de prueba desde panel admin

## 9) Recomendaciones de producción

1. Mantener PostgreSQL fuera del mismo servidor si es posible
2. Guardar backups fuera del servidor principal
3. No usar cuentas personales como remitente
4. Activar Turnstile en internet
5. Revisar logs con `journalctl -u api-fichar -f`
6. Probar restore al menos una vez al mes
