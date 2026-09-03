-- ─────────────────────────────────────────────────────────────────────────────
-- Bloqueo de cancha (motivo propio)
--
-- El club necesita marcar una cancha como ocupada por algo que no pasó por la
-- app: alguien llamó y reservó, o hay mantenimiento. Eso se guarda como fila de
-- `partidos` con estado 'bloqueado' para que la grilla siga leyendo de una sola
-- fuente, pero NO es un partido (ver src/lib/canchas/bloqueos.ts).
--
-- Antes el nombre se embutía dentro del texto de `lugar`
-- ("Club - cancha_1 (90 min) - a nombre de Juan") y había que sacarlo con
-- regex para mostrarlo. Esta columna le da su propio lugar.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE partidos
    ADD COLUMN IF NOT EXISTS bloqueo_motivo TEXT;

COMMENT ON COLUMN partidos.bloqueo_motivo IS
    'Solo para filas con estado=bloqueado: a nombre de quien o por que esta ocupada la cancha. Ver src/lib/canchas/bloqueos.ts';
