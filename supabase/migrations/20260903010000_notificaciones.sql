-- ─────────────────────────────────────────────────────────────────────────────
-- Notificaciones in-app (Fase D de amistosos)
--
-- Primer caso de uso: el ciclo de vida de un partido amistoso. Sin aviso, un
-- partido solo se llena si alguien lo comparte a mano — que es exactamente lo
-- que hizo que el flujo muriera antes (1 amistoso creado en toda la historia
-- de la app, auto-cancelado por falta de jugadores).
--
-- CONVENCIÓN DE IDs: `jugador_id` referencia `users.id` (el id público), NO
-- `users.auth_id`. Ojo que en el mismo dominio de amistosos conviven las dos
-- convenciones: `partidos.creador_id` y `partido_jugadores.jugador_id` sí
-- guardan auth_id. Ver src/lib/amistosos y src/lib/notificaciones.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jugador_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    mensaje TEXT,
    -- Ruta interna a la que lleva la notificación (ej. /partido/<id>).
    link TEXT,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notificaciones IS
    'Avisos in-app por jugador. jugador_id -> users.id (NO auth_id). Ver src/lib/notificaciones.';

-- La consulta caliente es "mis no leídas, más recientes primero".
CREATE INDEX IF NOT EXISTS idx_notificaciones_jugador
    ON notificaciones (jugador_id, leida, creado_en DESC);

-- RLS: cada jugador solo ve y marca como leídas LAS SUYAS. Las notificaciones
-- se crean siempre desde server actions con service-role (que se salta RLS),
-- así que no hace falta política de INSERT para usuarios normales.
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_select_propias ON notificaciones;
CREATE POLICY notificaciones_select_propias ON notificaciones
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = notificaciones.jugador_id AND u.auth_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS notificaciones_update_propias ON notificaciones;
CREATE POLICY notificaciones_update_propias ON notificaciones
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = notificaciones.jugador_id AND u.auth_id = auth.uid()
        )
    );
