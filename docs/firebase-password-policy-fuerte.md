# Guia: Politica de Contrasena Fuerte en Firebase

Objetivo: forzar que toda nueva contrasena cumpla:

- minimo 8 caracteres
- al menos 1 mayuscula
- al menos 1 numero
- al menos 1 simbolo

## 1. Requisitos previos

- Proyecto Firebase activo.
- Metodo `Email/Password` habilitado.
- Permiso de admin/owner en Firebase Console.

## 2. Activar metodo Email/Password

1. Entra a Firebase Console.
2. Ve a `Authentication` -> `Sign-in method`.
3. En `Email/Password`, activa el proveedor.
4. Guarda cambios.

## 3. Activar politica de contrasena

1. En `Authentication`, abre la seccion de configuracion de contrasenas (Password policy).
2. Activa politica de contrasena.
3. Configura:
   - `Minimum length`: `8`
   - `Require uppercase letter`: ON
   - `Require numeric character`: ON
   - `Require non-alphanumeric character`: ON
4. En modo de aplicacion, selecciona `Require` (no solo `Notify`).
5. Guarda cambios.

Referencia oficial:
- [Firebase password policy](https://firebase.google.com/docs/auth/web/password-auth)

## 4. Validacion funcional (prueba rapida)

1. Genera un enlace de reset para un usuario de prueba.
2. Intenta usar estas contrasenas:
   - `abc123` -> debe fallar.
   - `Abcdef12` -> debe fallar (sin simbolo).
   - `Abcdef12!` -> debe pasar.
3. Repite con alta nueva por email/password para confirmar mismo comportamiento.

## 5. Impacto en tu app actual

- Tu frontend no impone la regla final: la impone Firebase en su flujo de reset.
- Si un usuario no cumple politica, Firebase rechazara el cambio.
- Recomendacion UX: mostrar ayuda visual en pantalla:
  - "Minimo 8, 1 mayuscula, 1 numero, 1 simbolo".

## 6. Si quieres forzarlo tambien en UI propia

Si en futuro creas formulario propio de cambio de contrasena (no hosted page), valida en frontend y backend antes de enviar a Firebase para dar mensajes mas claros al usuario.
