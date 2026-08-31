-- ==========================================
-- Fase de Grupos Finales (torneo tipo liga)
-- ==========================================
-- Hasta ahora "torneo_grupos" solo representaba los grupos de la fase
-- todos-contra-todos (liga) o los grupos únicos de un Relámpago. Se agrega
-- `fase` para poder distinguir esos grupos ('inicial') de los grupos nuevos
-- que se arman con las parejas ya clasificadas, antes del cuadro de
-- eliminación ('finales') — solo aplica a torneos tipo liguilla.

ALTER TABLE torneo_grupos ADD COLUMN IF NOT EXISTS fase VARCHAR(20) NOT NULL DEFAULT 'inicial';

CREATE INDEX IF NOT EXISTS idx_torneo_grupos_fase ON torneo_grupos(torneo_id, categoria, fase);
