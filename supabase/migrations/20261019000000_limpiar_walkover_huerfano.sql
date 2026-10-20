-- "Reiniciar score" limpiaba el resultado pero no borraba el ganador por W,
-- así que el partido volvía a "programado" conservando la marca de W. La
-- tabla seguía viendo un partido ganado sin resultado.
--
-- El código ya borra el W al reiniciar y, por si acaso, la tabla ignora los W
-- de partidos que no estén jugados. Esto limpia los que quedaron.

update partidos
set walkover_ganador_id = null
where walkover_ganador_id is not null
  and estado is distinct from 'jugado'
  and estado_resultado is distinct from 'confirmado';
