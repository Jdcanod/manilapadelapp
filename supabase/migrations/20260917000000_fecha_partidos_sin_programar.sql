-- Los partidos que nunca se programaron en cancha (lugar = 'Pendiente')
-- nacieron con la fecha de inicio del torneo, porque partidos.fecha es
-- NOT NULL. En la liga eso hacía que todos se vieran "del 1 de septiembre".
--
-- Desde ahora, al registrar el resultado la fecha pasa a ser ese día. Esto
-- corrige los que ya estaban jugados, usando la fecha en que se cargó su
-- resultado. Los partidos programados en la parrilla no se tocan.

update partidos
set fecha = resultado_registrado_at
where lugar = 'Pendiente'
  and resultado is not null
  and resultado_registrado_at is not null;
