-- Excusa para el corte por participación.
--
-- Una pareja puede no llegar al mínimo de partidos por una razón atendible
-- (una incapacidad médica, por ejemplo). El club la marca con excusa y el
-- corte deja de sacarla: sigue en el torneo y CONSERVA sus partidos
-- pendientes, así que todavía puede alcanzar el mínimo jugando.
--
-- La excusa NO la exime de clasificar: si al final no llega al mínimo, no
-- entra a la fase final igual que cualquiera. Salva del corte, no del
-- requisito.
--
-- El motivo se guarda a propósito: que el resto del club pueda ver por qué
-- esa pareja sigue es lo que evita que parezca favoritismo.

alter table torneo_parejas
    add column if not exists excusa boolean not null default false,
    add column if not exists excusa_motivo text,
    add column if not exists excusa_en timestamptz;

comment on column torneo_parejas.excusa is
    'El corte por participación no saca a esta pareja. No la exime de cumplir el mínimo para clasificar.';
