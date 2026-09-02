-- ==========================================
-- Papelera de torneos: borrado suave en vez de DELETE irreversible.
-- ==========================================
--
-- Hoy `deleteTorneo` borra en cascada partidos/grupos/inscripciones/torneo
-- de una vez — un clic accidental es irrecuperable. Con `borrado_en`,
-- "eliminar" desde el club solo marca el torneo (todo lo demás queda
-- intacto) y se puede restaurar exactamente como estaba desde una vista de
-- Papelera. El DELETE de verdad (irreversible) queda solo para "Eliminar
-- definitivo" desde la Papelera, o para la purga automática a los 30 días.

ALTER TABLE torneos ADD COLUMN borrado_en TIMESTAMPTZ;

CREATE INDEX idx_torneos_borrado_en ON torneos (club_id, borrado_en);
