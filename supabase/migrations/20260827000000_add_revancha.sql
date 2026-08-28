-- ==========================================
-- ManilaPadelAPP - Revancha (torneo tipo liga)
-- ==========================================
-- Partido extra opcional que crea el dueño del torneo sobre un partido de
-- liguilla ya jugado y confirmado, contra el mismo rival. Vale la mitad de
-- puntos (ganador 1.5, perdedor 0.5) y cuenta como 0.5 "partidos jugados".
-- Todo ese cálculo se hace en la aplicación — estas columnas solo marcan el
-- hecho y enlazan la revancha con su partido original.

ALTER TABLE partidos ADD COLUMN IF NOT EXISTS es_revancha BOOLEAN DEFAULT FALSE;
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS revancha_de_partido_id UUID REFERENCES partidos(id) ON DELETE SET NULL;

-- Máximo 1 revancha por partido original.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partidos_revancha_unica
    ON partidos(revancha_de_partido_id)
    WHERE revancha_de_partido_id IS NOT NULL;
