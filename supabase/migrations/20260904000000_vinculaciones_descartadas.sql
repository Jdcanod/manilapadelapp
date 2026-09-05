-- ─────────────────────────────────────────────────────────────────────────────
-- Sugerencias de vinculación descartadas
--
-- El panel de "invitados que quizá ya tienen cuenta" empareja por nombre, así
-- que propone falsos positivos: en Padel del Río hay 165 sugerencias y muchas
-- son gente distinta que comparte nombre. Sin poder decir "no es", el club ve
-- las mismas sugerencias equivocadas para siempre y el panel deja de servir.
--
-- Se descarta el PAR (invitado, jugador), no el invitado: que "Juan Duque"
-- invitado no sea ESE Juan Duque no significa que no pueda ser otro.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vinculaciones_descartadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Quién descartó: la sugerencia es propia de cada club.
    club_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitado_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jugador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE vinculaciones_descartadas IS
    'Pares (invitado, jugador) que el club marco como personas distintas. Ver src/lib/invitados/sugerencias.ts';

-- Un mismo par no se descarta dos veces por club.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vinculaciones_descartadas_par
    ON vinculaciones_descartadas (club_id, invitado_id, jugador_id);

-- Se lee entero por club cada vez que se arman las sugerencias.
CREATE INDEX IF NOT EXISTS idx_vinculaciones_descartadas_club
    ON vinculaciones_descartadas (club_id);

-- Solo las server actions (service-role) tocan esta tabla.
ALTER TABLE vinculaciones_descartadas ENABLE ROW LEVEL SECURITY;
