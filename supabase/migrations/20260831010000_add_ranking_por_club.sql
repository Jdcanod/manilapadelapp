-- ==========================================
-- Ranking por club + ranking global (promedio)
-- ==========================================
-- Hasta ahora `users.nivel_ranking` / `users.categoria_jugador` eran un
-- único valor global por jugador, compartido (y sobre-escribible) por
-- cualquier club donde el jugador hubiera jugado. Se separa en un nivel
-- POR CLUB — cada club valora al jugador de forma independiente — y el
-- "ranking global" pasa a ser el promedio de esos niveles por club,
-- calculado en la aplicación (no se persiste).

CREATE TABLE IF NOT EXISTS ranking_club_jugador (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES users(id) ON DELETE CASCADE,
    jugador_id UUID REFERENCES users(id) ON DELETE CASCADE,
    categoria_jugador VARCHAR(20),
    nivel_ranking NUMERIC(5,3),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(club_id, jugador_id)
);

CREATE INDEX IF NOT EXISTS idx_ranking_club_jugador_club ON ranking_club_jugador(club_id);
CREATE INDEX IF NOT EXISTS idx_ranking_club_jugador_jugador ON ranking_club_jugador(jugador_id);

-- El historial de cambios (por partido y por bono de posición) ahora queda
-- atribuido al club donde se jugó, para poder sumarlo/filtrarlo por club
-- (tendencia semanal, auditoría). Nullable porque las filas históricas
-- previas a esta migración no tienen club conocido sin hacer un join.
ALTER TABLE ranking_nivel_historial ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ranking_bono_historial ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ranking_nivel_historial_club ON ranking_nivel_historial(club_id, jugador_id);
CREATE INDEX IF NOT EXISTS idx_ranking_bono_historial_club ON ranking_bono_historial(club_id, jugador_id);
