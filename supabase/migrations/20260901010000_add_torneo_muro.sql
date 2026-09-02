-- ==========================================
-- Muro del Torneo: reglas, fechas importantes y anuncios que el club
-- publica en un torneo específico, visibles para los jugadores inscritos.
-- ==========================================
--
-- Una sola tabla con `tipo` en vez de tres tablas separadas: reglas y fechas
-- se ordenan a mano (columna `orden`, como ya hacen los grupos), anuncios se
-- muestran cronológicamente (created_at desc). El club los administra desde
-- un único tab "Muro" en /club/torneos/[id]; el jugador los ve de solo
-- lectura en /torneos/[id].
--
-- Mismo patrón de seguridad que el resto del código (ver
-- 20260828000000_enable_rls_core_tables.sql): SELECT abierto a cualquier
-- usuario autenticado, sin políticas de escritura para `authenticated` —
-- todas las mutaciones pasan por server actions con requireClubOwnership()
-- + service-role.

CREATE TABLE torneo_muro_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    torneo_id UUID NOT NULL REFERENCES torneos(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('regla', 'fecha_importante', 'anuncio')),
    titulo TEXT NOT NULL,
    contenido TEXT,
    fecha_evento TIMESTAMPTZ, -- solo aplica a tipo='fecha_importante'
    orden INTEGER NOT NULL DEFAULT 0, -- orden manual para reglas/fechas
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_torneo_muro_posts_torneo ON torneo_muro_posts (torneo_id, tipo);

ALTER TABLE torneo_muro_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY torneo_muro_posts_select_authenticated ON torneo_muro_posts
    FOR SELECT TO authenticated
    USING (true);
