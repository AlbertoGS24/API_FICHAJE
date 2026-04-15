/**
 * Este controller tiene una ruta GET /me que devuelve la información del usuario autenticado.
 * La ruta está protegida por el FirebaseAuthGuard, que verifica el token de Firebase en la cabecera Authorization.
 * Si el token es válido, el guard decodifica el token y adjunta la información del usuario a la request (req.user).
 * Luego, en el controller, podemos acceder a req.user para obtener el uid, email y name del usuario autenticado y devolverlo en la respuesta.
 * El controller también usa decoradores de Swagger para documentar la ruta y el esquema de autenticación.
 * En resumen, este controller es un ejemplo de cómo proteger una ruta con autenticación de Firebase y devolver la información del usuario autenticado.
 */

/**
 * @Get('me'): crea el endpoint /me
 * @UseGuards(FirebaseAuthGuard): obliga a mandar token válido
 * req.user: es el token decodificado que el guard guardó en la request
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import type { RequestWithUser } from '../auth/request-with-user';
import { UsersService } from './users.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @Get('me')
  async getMe(@Req() req: RequestWithUser) {
    const firebaseUid = req.user.uid;
    const rawEmail: unknown = req.user.email;
    const rawName: unknown = req.user.name;
    const email = typeof rawEmail === 'string' ? rawEmail : null;
    const name = typeof rawName === 'string' ? rawName : null;

    return this.usersService.upsertFromToken(firebaseUid, email, name);
  }

  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @Get('me/progress')
  async getMyProgress(@Req() req: RequestWithUser) {
    return this.usersService.getProgressByFirebaseUid(req.user.uid);
  }

  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @Get('me/profile')
  async getMyProfile(@Req() req: RequestWithUser) {
    return this.usersService.getProfileByFirebaseUid(req.user.uid);
  }

  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @Post('me/profile')
  async updateMyProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.usersService.updateMyProfile(req.user.uid, dto);
  }

  @ApiBearerAuth()
  @UseGuards(FirebaseAuthGuard)
  @Delete('me')
  async deleteMyAccount(@Req() req: RequestWithUser) {
    return this.usersService.deleteMyAccount(req.user.uid);
  }
}
