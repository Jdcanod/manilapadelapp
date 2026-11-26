/**
 * Marca en `app_metadata` de la cuenta: su contraseña es temporal (la puso
 * el superadmin al restablecerla). Mientras esté en true, el middleware no
 * deja usar la app hasta elegir una nueva en /cambiar-contrasena.
 *
 * Va en app_metadata y no en user_metadata porque el usuario no puede
 * escribir app_metadata desde el navegador: no se la puede quitar solo.
 */
export const MARCA_CONTRASENA_TEMPORAL = "debe_cambiar_contrasena";

export const RUTA_CAMBIAR_CONTRASENA = "/cambiar-contrasena";
