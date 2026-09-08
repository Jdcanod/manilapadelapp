-- Paso 2: cerrar la lectura anonima de datos personales.
--
-- Medido con la clave anonima: `users` devolvia 438 filas COMPLETAS, con
-- email, telefono y fecha_nacimiento. Una lista de contactos de todos los
-- jugadores lista para copiar. Ademas partidos (791), parejas (358) y el
-- grafo social quedaban a la vista de cualquiera.
--
-- ─── Por que revocar el GRANT y no tocar las politicas ─────────────────────
-- Estas tablas YA tienen RLS activo (las escrituras anonimas rebotan con
-- 42501); lo que las abre es una politica de SELECT permisiva. Reemplazar esa
-- politica exigiria conocer su nombre y arriesgaria romper a los usuarios con
-- sesion. Quitarle el GRANT al rol `anon` es quirurgico: `authenticated` y la
-- clave de servicio no se tocan, asi que la app sigue igual.
--
-- ─── Verificado antes de escribir esto ─────────────────────────────────────
-- - /partido/[id], el enlace que se comparte por WhatsApp, lee TODO con la
--   clave de servicio. Sigue abriendo para quien no tiene cuenta.
-- - / y /nosotros no consultan la base.
-- - /login consulta `users` DESPUES de autenticarse, o sea ya con sesion.
-- - /registro SI lee `users` sin sesion, para listar los clubes: por eso
--   `users` conserva un grant por columnas en vez de cerrarse del todo.
-- - Ningun componente del navegador escribe estas tablas.

-- ─── users: lo unico que el anonimo necesita es la lista de clubes ─────────
-- El filtro `.eq('rol','admin_club')` de /registro exige poder leer `rol`,
-- por eso va en la lista. Fuera quedan email, telefono, fecha_nacimiento, bio
-- y toda la configuracion comercial del club (precios, canchas, horarios).
revoke select on public.users from anon;
grant select (id, auth_id, nombre, apellido, ciudad, foto, rol) on public.users to anon;

-- ─── El resto: nada que hacer sin cuenta ───────────────────────────────────
revoke select on public.partidos from anon;
revoke select on public.parejas from anon;
revoke select on public.club_news from anon;
revoke select on public.inscripciones_torneo from anon;
revoke select on public.club_seguidores from anon;
revoke select on public.jugador_seguidores from anon;
revoke select on public.partido_likes from anon;

-- ─── Comprobacion ──────────────────────────────────────────────────────────
-- Deberia devolver solo las columnas publicas de `users`:
--
--   select table_name, column_name
--   from information_schema.column_privileges
--   where grantee = 'anon' and table_schema = 'public'
--   order by table_name, column_name;
