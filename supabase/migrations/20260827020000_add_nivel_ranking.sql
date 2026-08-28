-- ==========================================
-- Ranking por nivel de juego (escala 0-5)
-- ==========================================

-- Categoría base del jugador (4ta/5ta/6ta/7ma...), asignada manualmente por el club.
ALTER TABLE users ADD COLUMN IF NOT EXISTS categoria_jugador VARCHAR(20);

-- Nivel de ranking en escala 0-5. NULL hasta que el club asigne una categoría
-- base o lo edite manualmente; mientras sea NULL, el jugador no participa
-- en el cálculo automático (ver recalcularNivelPorPartido).
ALTER TABLE users ADD COLUMN IF NOT EXISTS nivel_ranking NUMERIC(5,3);

-- Historial de cambios de nivel, uno por (partido, jugador). Sirve de log de
-- auditoría y como guardia de idempotencia: si ya existe una fila para un
-- partido+jugador, no se vuelve a aplicar el delta cuando se re-procesa el partido.
CREATE TABLE IF NOT EXISTS ranking_nivel_historial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jugador_id UUID REFERENCES users(id) ON DELETE CASCADE,
    partido_id UUID REFERENCES partidos(id) ON DELETE CASCADE,
    nivel_antes NUMERIC(5,3) NOT NULL,
    nivel_despues NUMERIC(5,3) NOT NULL,
    delta NUMERIC(5,3) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jugador_id, partido_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_nivel_historial_jugador ON ranking_nivel_historial(jugador_id);
