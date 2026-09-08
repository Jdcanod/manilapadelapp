-- URGENTE: cuatro tablas sin RLS que CUALQUIERA podia escribir.
--
-- Verificado con la clave anonima (la misma que va incrustada en el JS del
-- sitio y que cualquiera extrae del navegador): un POST vacio a
-- `ranking_club_jugador` y a `torneo_parejas` devolvio 201 y creo la fila.
-- Es decir, un desconocido podia cambiarle el nivel a cualquier jugador,
-- ponerse primero del ranking, o inscribir y eliminar parejas de un torneo.
--
-- `torneo_grupos` y `ranking_nivel_historial` respondieron 23502 (falta una
-- columna), que tambien confirma permiso de escritura: el INSERT llego hasta
-- la validacion de datos en vez de rebotar contra una politica.
--
-- ─── Por que solo politicas de SELECT ──────────────────────────────────────
-- Todas las escrituras de la app corren con la clave de servicio
-- (createAdminClient / createPureAdminClient), que SALTA RLS por diseño. Asi
-- que activar RLS sin politicas de escritura cierra la puerta a los de afuera
-- y no le quita nada a la app.
--
-- Se verifico que ningun componente del navegador escribe estas tablas
-- directamente, y que las paginas publicas (/, /nosotros, /partido/[id],
-- login y registro) no las consultan — /partido/[id] usa la clave de
-- servicio. Por eso la lectura puede exigir sesion sin romper el enlace que
-- se comparte por WhatsApp.

-- ─── ranking_club_jugador ──────────────────────────────────────────────────
alter table public.ranking_club_jugador enable row level security;

drop policy if exists "lectura autenticada" on public.ranking_club_jugador;
create policy "lectura autenticada"
    on public.ranking_club_jugador for select
    to authenticated
    using (true);

-- ─── torneo_parejas ────────────────────────────────────────────────────────
alter table public.torneo_parejas enable row level security;

drop policy if exists "lectura autenticada" on public.torneo_parejas;
create policy "lectura autenticada"
    on public.torneo_parejas for select
    to authenticated
    using (true);

-- ─── torneo_grupos ─────────────────────────────────────────────────────────
alter table public.torneo_grupos enable row level security;

drop policy if exists "lectura autenticada" on public.torneo_grupos;
create policy "lectura autenticada"
    on public.torneo_grupos for select
    to authenticated
    using (true);

-- ─── ranking_nivel_historial ───────────────────────────────────────────────
alter table public.ranking_nivel_historial enable row level security;

drop policy if exists "lectura autenticada" on public.ranking_nivel_historial;
create policy "lectura autenticada"
    on public.ranking_nivel_historial for select
    to authenticated
    using (true);
