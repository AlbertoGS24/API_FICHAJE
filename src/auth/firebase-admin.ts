/**
 * Archivo para inicializar Firebase Admin SDK
 * Lee las credenciales del servicio desde un archivo JSON local (en desarrollo) o desde variables de entorno (en producción)
 * Exporta una función getFirebaseAdminApp() que devuelve la instancia de Firebase Admin, inicializándola solo una vez
 * Esta función se usa en el guard para verificar los tokens de Firebase en cada petición
 * De esta forma, centralizamos la configuración de Firebase Admin y evitamos inicializarlo múltiples veces
 * El SDK de Firebase Admin se encarga de verificar los tokens y decodificar la información del usuario, que luego se adjunta a la request en el guard.
 */

/**
 * Lee el archivo firebase-service-account.json
 * Inicializa Firebase Admin una sola vez
 * Deja listo el SDK para verificar tokens */

import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

let firebaseApp: admin.app.App | null = null;

export function getFirebaseAdminApp(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  // Lee el JSON local (solo desarrollo). En producción se suele usar variable de entorno.
  const serviceAccountPath = join(
    process.cwd(),
    'secrets',
    'firebase-service-account.json',
  );

  const serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, 'utf8'),
  ) as admin.ServiceAccount; // Asegura que el JSON tenga la forma correcta y no lo trate como 'any'.

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return firebaseApp;
}
