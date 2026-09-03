/**
 * Valida el parámetro `?next=` de login/registro antes de redirigir.
 *
 * Sin esta validación tendríamos un open redirect: `/login?next=https://sitio-falso.com`
 * mandaría al usuario fuera de la app justo después de autenticarse, que es el
 * escenario clásico de phishing. Solo aceptamos rutas internas.
 *
 * @returns la ruta si es segura, o null si hay que ignorarla y usar el destino por defecto.
 */
export function destinoSeguro(next: string | null | undefined): string | null {
    if (!next) return null;

    // Debe ser una ruta relativa a la raíz...
    if (!next.startsWith('/')) return null;
    // ...pero no protocol-relative ("//evil.com" navega fuera del sitio).
    if (next.startsWith('//')) return null;
    // Ni intentos de colar un esquema por encoding ("/\evil.com", "/%2Fevil.com").
    if (next.startsWith('/\\')) return null;
    if (/^\/%2f/i.test(next)) return null;

    return next;
}
