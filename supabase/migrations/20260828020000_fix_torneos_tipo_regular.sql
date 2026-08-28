-- ==========================================
-- Fix: torneos de club marcados incorrectamente como tipo='master'
-- ==========================================
-- crearTorneoCentral nunca seteaba `tipo` explícitamente, así que cada
-- torneo de club caía en el default de la columna (que resultó ser
-- 'master') en vez de 'regular'. Esto rompía "Inscripción Manual" — el
-- código la trataba como si fuera un Torneo Ciudad (inscripciones_torneo,
-- sin pareja real asociada) en vez del sistema normal de parejas
-- (torneo_parejas), dejando las parejas nuevas sin poder integrarse
-- correctamente a la tabla (aparecían como "TBD" al intentar ubicarlas).
--
-- Todo torneo con club_id es, por definición, un torneo de club normal —
-- los Torneos Ciudad (tipo='master' real) los crea el superadmin sin
-- club_id. Confirmado contra los datos actuales: ningún torneo tiene
-- tipo='master' sin club_id, así que este UPDATE es seguro.

UPDATE torneos SET tipo = 'regular' WHERE club_id IS NOT NULL AND (tipo IS DISTINCT FROM 'regular');
