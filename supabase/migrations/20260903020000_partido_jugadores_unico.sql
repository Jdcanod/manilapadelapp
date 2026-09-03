-- ─────────────────────────────────────────────────────────────────────────────
-- Un jugador no puede estar dos veces en el mismo partido.
--
-- Sin esta restricción, la validación "¿ya estabas apuntado?" vivía solo en el
-- código, y como se hacía ANTES del insert, dos ejecuciones de la acción que
-- se solapan la pasaban las dos y el partido terminaba descontando dos cupos
-- por una sola inscripción (observado en pruebas: 1 inscrito, cupos 3 -> 1).
--
-- Con el índice único, la segunda inscripción falla en la base y la acción
-- puede distinguir "duplicado" de "error real" sin adivinar.
-- ─────────────────────────────────────────────────────────────────────────────

-- Por si quedaron duplicados de antes: dejar solo el más antiguo de cada par.
DELETE FROM partido_jugadores a
    USING partido_jugadores b
WHERE a.partido_id = b.partido_id
  AND a.jugador_id = b.jugador_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partido_jugadores_unico
    ON partido_jugadores (partido_id, jugador_id);
