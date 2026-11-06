-- Gestores de un torneo: el club crea el torneo y delega la operación diaria
-- (cargar resultados y programar partidos) en una o varias personas.
--
-- El permiso es POR TORNEO, no por club: quien ayuda en la liga no queda con
-- acceso al relámpago del mes siguiente, y al terminar el torneo el permiso
-- deja de importar sin tener que acordarse de revocarlo.
--
-- `jugador_id` apunta a users.id (no auth_id): cualquier jugador registrado
-- puede ser gestor, no hace falta que sea del club.
--
-- Sin políticas de lectura/escritura a propósito: esta tabla solo se toca
-- desde el servidor con la service role, igual que el resto de la gestión del
-- torneo. RLS activo sin políticas = nadie llega por el cliente.

create table if not exists torneo_gestores (
    id uuid primary key default gen_random_uuid(),
    torneo_id uuid not null references torneos(id) on delete cascade,
    jugador_id uuid not null references users(id) on delete cascade,
    creado_en timestamptz not null default now(),
    -- Quién lo nombró, para poder responder "¿y este quién lo puso?".
    creado_por uuid references users(id),
    unique (torneo_id, jugador_id)
);

create index if not exists idx_torneo_gestores_torneo on torneo_gestores(torneo_id);
create index if not exists idx_torneo_gestores_jugador on torneo_gestores(jugador_id);

alter table torneo_gestores enable row level security;

comment on table torneo_gestores is
    'Personas autorizadas por el club para operar un torneo: cargar resultados y programar partidos. No pueden sortear, eliminar parejas ni ejecutar el corte.';
