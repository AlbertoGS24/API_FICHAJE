/**
 * Este guard se encarga de verificar el token de Firebase en cada petición.
 * Si el token es válido, decodifica el usuario y lo adjunta a la request para que los controllers puedan usarlo.
 * Si el token no es válido o falta, lanza una excepción de Unauthorized.
 * Usamos el SDK de Firebase Admin para verificar el token, que a su vez usa las credenciales del servicio.
 * El guard se puede aplicar a rutas específicas o globalmente en el módulo de autenticación.
 * En este ejemplo, el guard se llama FirebaseAuthGuard y se implementa la interfaz CanActivate de NestJS.
 * El guard lee el token del header Authorization, lo verifica con Firebase Admin, y si es correcto, adjunta el usuario decodificado a la request.
 * El guard también maneja errores comunes como falta de token, formato incorrecto, o token inválido, lanzando excepciones adecuadas.
 * En resumen, este guard es la pieza clave para proteger las rutas de la API y asegurar que solo usuarios autenticados con Firebase puedan acceder a ellas.
 */

import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { getFirebaseAdminApp } from './firebase-admin';
import { RequestWithUser } from './request-with-user';

export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithUser>();

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Invalid Authorization format. Use: Bearer <token>',
      );
    }

    try {
      const adminApp = getFirebaseAdminApp();
      const decoded = await adminApp.auth().verifyIdToken(token);

      // Guardamos el usuario decodificado para usarlo en controllers
      req.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
