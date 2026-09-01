-- ==========================================
-- Eliminar restricción "una pareja activa por jugador"
-- ==========================================
-- Un jugador puede jugar en varias parejas simultáneamente (categorías
-- distintas, torneos distintos). El índice único parcial que exigía "solo
-- una pareja activa" bloqueaba esto (fallaba al editar integrantes de una
-- inscripción, al vincular un invitado a un jugador que ya tiene pareja
-- activa, etc.) y no cumple ningún propósito visible: en toda la app no
-- hay ninguna consulta que filtre por `activa = true` para decidir qué
-- mostrar — el "Pareja actual" del dashboard del jugador toma la última
-- pareja de la lista, sin mirar `activa`.

DROP INDEX IF EXISTS idx_jugador1_activo;
DROP INDEX IF EXISTS idx_jugador2_activo;
