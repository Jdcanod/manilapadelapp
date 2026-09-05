-- Interruptor de notificaciones.
--
-- Hoy no hay forma de apagarlas: un partido creado por el club le avisa a ~90
-- personas y la unica novedad publicada quedo con 82 de 92 sin leer. Sin este
-- control, subir el volumen de avisos solo empeora la senal.
--
-- Tres grupos, no ocho interruptores: la pantalla que nadie configura es la
-- que tiene demasiadas opciones.
--
--   mis_partidos   -> alguien se unio o salio, se completo, se cancelo, el
--                     club te inscribio. Te involucran a vos directamente.
--   partidos_abiertos -> amistosos nuevos de tu categoria. Invitacion, no aviso.
--   novedades      -> muro del club y muro de torneos. Difusion.
--
-- La ausencia de fila significa "todo encendido": no hay que sembrar nada para
-- los 247 jugadores que ya existen, y un jugador nuevo tampoco necesita fila.

create table if not exists public.preferencias_notificaciones (
    jugador_id uuid primary key references public.users(id) on delete cascade,
    mis_partidos boolean not null default true,
    partidos_abiertos boolean not null default true,
    novedades boolean not null default true,
    actualizado_en timestamptz not null default now()
);

comment on table public.preferencias_notificaciones is
    'Que avisos quiere recibir cada jugador. Sin fila = todo encendido.';

alter table public.preferencias_notificaciones enable row level security;

-- Cada jugador manda sobre lo suyo y nada mas. El envio corre con la clave de
-- servicio, que salta RLS, asi que no hace falta politica de lectura para el.
drop policy if exists "cada jugador ve sus preferencias" on public.preferencias_notificaciones;
create policy "cada jugador ve sus preferencias"
    on public.preferencias_notificaciones for select
    using (jugador_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "cada jugador crea sus preferencias" on public.preferencias_notificaciones;
create policy "cada jugador crea sus preferencias"
    on public.preferencias_notificaciones for insert
    with check (jugador_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "cada jugador cambia sus preferencias" on public.preferencias_notificaciones;
create policy "cada jugador cambia sus preferencias"
    on public.preferencias_notificaciones for update
    using (jugador_id in (select id from public.users where auth_id = auth.uid()))
    with check (jugador_id in (select id from public.users where auth_id = auth.uid()));

-- Las 92 notificaciones que existen son de una sola prueba ("prueba se acerca
-- torneo"), con 82 sin leer. Se borran: nadie pierde nada real y 92 personas
-- dejan de arrastrar un pendiente que nunca les importo.
delete from public.notificaciones where tipo = 'club_novedad';
