-- Retiro de una pareja con el torneo en curso.
--
-- Distinto de `eliminada`, que la pone el corte por participación: ahí el club
-- saca a quien no jugó lo suficiente. `retirada` es voluntario -la pareja
-- avisa que no sigue- y se decide en cualquier momento.
--
-- En ambos casos la pareja permanece en la tabla con sus resultados, porque
-- los partidos que ya jugó afectaron a sus rivales y borrarlos falsearía el
-- torneo. Lo que se cancela son sus partidos pendientes.

alter table torneo_parejas
    add column if not exists retirada boolean not null default false,
    add column if not exists retirada_en timestamptz;

comment on column torneo_parejas.retirada is
    'La pareja se retiró del torneo: conserva lo jugado, no clasifica y sus partidos pendientes se cancelaron.';
