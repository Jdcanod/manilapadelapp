-- ==========================================
-- ManilaPadelAPP - Corte de participación (torneo tipo liga)
-- ==========================================
-- Una pareja marcada como eliminada por el corte sigue en la tabla de
-- posiciones (no se borra su inscripción ni sus partidos ya jugados), pero
-- queda excluida de la clasificación a la fase final.

ALTER TABLE torneo_parejas ADD COLUMN IF NOT EXISTS eliminada BOOLEAN DEFAULT FALSE;
ALTER TABLE torneo_parejas ADD COLUMN IF NOT EXISTS eliminada_en TIMESTAMP WITH TIME ZONE;
