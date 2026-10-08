-- `generarFaseGrupos` escribía `tipo_partido_oficial = 'torneo'` pero nunca
-- `tipo_partido`, así que esos partidos quedaron con el valor por defecto de
-- la columna, 'Amistoso', pese a pertenecer a un torneo.
--
-- Eso rompía dos cosas: el club no podía crear revanchas sobre ellos, y el
-- control que impide que la pareja rival se auto-confirme el resultado de un
-- partido de torneo no se activaba.
--
-- Esto corrige los que ya están. El código, además, dejó de depender de una
-- sola columna: ahora basta con que el partido tenga torneo_id.

update partidos
set tipo_partido = 'torneo'
where torneo_id is not null
  and tipo_partido is distinct from 'torneo';
