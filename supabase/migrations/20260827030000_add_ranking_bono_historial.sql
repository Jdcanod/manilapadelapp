-- ==========================================
-- Bono de nivel por posición en torneo (campeón/subcampeón/3er/participación)
-- ==========================================

-- Historial + guardia de idempotencia: un jugador solo puede recibir UN bono
-- por (torneo, categoría), sin importar cuántas veces se reprocese la final.
CREATE TABLE IF NOT EXISTS ranking_bono_historial (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jugador_id UUID REFERENCES users(id) ON DELETE CASCADE,
    torneo_id UUID REFERENCES torneos(id) ON DELETE CASCADE,
    categoria VARCHAR(50) NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- 'campeon' | 'subcampeon' | 'tercer_puesto' | 'participacion'
    delta NUMERIC(5,3) NOT NULL,
    nivel_antes NUMERIC(5,3) NOT NULL,
    nivel_despues NUMERIC(5,3) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jugador_id, torneo_id, categoria)
);

CREATE INDEX IF NOT EXISTS idx_ranking_bono_historial_jugador ON ranking_bono_historial(jugador_id);

-- ranking_config_json (en `users`) se reutiliza: antes guardaba "puntos" enteros
-- para el ranking viejo, ahora guarda el bono de nivel en escala 0-5 (decimales,
-- ej. campeón 0.15). Ver DEFAULT_CONFIG en club/ranking/page.tsx.
