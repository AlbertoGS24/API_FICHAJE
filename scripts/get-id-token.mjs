/**
 * Este script es una herramienta de desarrollo para obtener un ID token de Firebase usando las credenciales de un usuario de prueba.
 * Se utiliza para probar la autenticación en el backend sin necesidad de pasar por el proceso de login en la app.
 * Lee las variables de entorno FIREBASE_WEB_API_KEY, TEST_EMAIL y TEST_PASSWORD, hace una petición a la API de Firebase para obtener un ID token y lo imprime en consola.
 * Es útil para obtener un token válido que se pueda usar en herramientas como Postman o curl para probar los endpoints protegidos del backend.
 * Para usarlo, asegúrate de tener las variables de entorno configuradas correctamente y luego ejecuta el script con Node.js.
 * Ejemplo de uso:
 *   FIREBASE_WEB_API_KEY=tu_api_key
 *   TEST_EMAIL=usuario@ejemplo.com
 *   TEST_PASSWORD=contraseña_segura
 *  node scripts/get-id-token.mjs
 */

const API_KEY = process.env.FIREBASE_WEB_API_KEY;
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!API_KEY || !EMAIL || !PASSWORD) {
  console.error('Faltan variables: FIREBASE_WEB_API_KEY, TEST_EMAIL, TEST_PASSWORD');
  process.exit(1);
}

const res = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  }
);

if (!res.ok) {
  console.error('Error en login:', await res.text());
  process.exit(1);
}

const data = await res.json();
console.log('\nID_TOKEN:\n');
console.log(data.idToken);