-- Push web: a donde mandarle el aviso a cada dispositivo.
--
-- Una fila por DISPOSITIVO, no por jugador: la misma persona puede tener el
-- celular y el computador, y cada uno tiene su propio endpoint. El endpoint es
-- la clave natural — el navegador lo regenera si cambia, y entonces entra como
-- una suscripcion nueva.
--
-- Esto no reemplaza a `preferencias_notificaciones`: el push respeta los mismos
-- tres grupos. Estar suscrito dice DONDE avisar, no QUE avisar.

create table if not exists public.push_suscripciones (
    id uuid primary key default gen_random_uuid(),
    jugador_id uuid not null references public.users(id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    -- Para poder decirle a la gente "este es tu iPhone" si algun dia listamos
    -- los dispositivos, y para depurar entregas fallidas.
    user_agent text,
    creado_en timestamptz not null default now(),
    -- Se toca en cada envio exitoso: sirve para limpiar las muertas.
    ultimo_uso timestamptz
);

comment on table public.push_suscripciones is
    'Un dispositivo suscrito a push web. El endpoint es unico: si el navegador lo regenera, entra como suscripcion nueva.';

create index if not exists push_suscripciones_jugador_idx
    on public.push_suscripciones (jugador_id);

alter table public.push_suscripciones enable row level security;

-- El jugador administra las suyas. El envio corre con la clave de servicio,
-- que salta RLS.
drop policy if exists "cada jugador ve sus suscripciones" on public.push_suscripciones;
create policy "cada jugador ve sus suscripciones"
    on public.push_suscripciones for select
    using (jugador_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "cada jugador crea sus suscripciones" on public.push_suscripciones;
create policy "cada jugador crea sus suscripciones"
    on public.push_suscripciones for insert
    with check (jugador_id in (select id from public.users where auth_id = auth.uid()));

drop policy if exists "cada jugador borra sus suscripciones" on public.push_suscripciones;
create policy "cada jugador borra sus suscripciones"
    on public.push_suscripciones for delete
    using (jugador_id in (select id from public.users where auth_id = auth.uid()));
