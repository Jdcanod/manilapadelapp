-- ==========================================
-- RLS real en users / torneos / partidos / parejas (Fase 3 seguridad)
-- ==========================================
--
-- Hasta ahora NINGUNA tabla tenía RLS: toda la protección dependía de que
-- cada server action recordara verificar sesión + rol + dueño a mano (Fases
-- 1 y 2 ya centralizaron eso para club/torneos). Esta migración agrega la
-- red de seguridad real a nivel de base de datos.
--
-- Diseño:
--  - SELECT: abierto a cualquier usuario autenticado en las 4 tablas. La
--    lectura no es el problema de seguridad aquí (nada in-app restringe hoy
--    qué torneo/partido/pareja puede VER un jugador logueado, y cambiar eso
--    rompería flujos de navegación existentes). Lo que sí se cierra es el
--    acceso anónimo directo vía REST con la anon key — antes, sin RLS,
--    cualquiera con la key pública (visible en el bundle del cliente) podía
--    leer TODA la tabla sin pasar por la app. Ahora se exige sesión.
--  - INSERT/UPDATE/DELETE: solo permitido cuando la fila pertenece al
--    usuario autenticado, replicando exactamente la regla que ya aplica el
--    código de la app (creador_id/auth_id propio, o pareja/torneo propios).
--    Cualquier mutación que no cumpla la condición es bloqueada por
--    Postgres mismo, sin importar si el server action que la origina tiene
--    o no su propio chequeo.
--  - Las escrituras administrativas (generación de brackets, resultados de
--    torneo, revanchas, ranking, etc.) siguen funcionando igual: usan
--    createPureAdminClient()/createAdminClient() con la service-role key,
--    que en Supabase siempre bypassea RLS por diseño (atributo BYPASSRLS).

-- ─── users ──────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_authenticated ON users
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY users_update_own_or_superadmin ON users
    FOR UPDATE TO authenticated
    USING (
        auth_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users me WHERE me.auth_id = auth.uid() AND me.rol = 'superadmin')
    )
    WITH CHECK (
        auth_id = auth.uid()
        OR EXISTS (SELECT 1 FROM users me WHERE me.auth_id = auth.uid() AND me.rol = 'superadmin')
    );

-- Sin política de INSERT/DELETE para `authenticated`: el registro de
-- usuarios (incluidos invitados) siempre pasa por rutas con service-role.

-- ─── torneos ────────────────────────────────────────────────────────────
ALTER TABLE torneos ENABLE ROW LEVEL SECURITY;

CREATE POLICY torneos_select_authenticated ON torneos
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY torneos_insert_own_club ON torneos
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid() AND u.id = club_id AND u.rol = 'admin_club'
        )
    );

-- Sin política de UPDATE/DELETE para `authenticated`: toda edición de
-- torneos ya pasa por server actions con requireClubOwnership() +
-- service-role (Fases 1 y 2).

-- ─── parejas ────────────────────────────────────────────────────────────
ALTER TABLE parejas ENABLE ROW LEVEL SECURITY;

CREATE POLICY parejas_select_authenticated ON parejas
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY parejas_insert_propia ON parejas
    FOR INSERT TO authenticated
    WITH CHECK (
        jugador1_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
        OR jugador2_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    );

-- Sin política de UPDATE/DELETE para `authenticated`: las ediciones de
-- parejas dentro de un torneo ya pasan por server actions con service-role.

-- ─── partidos ───────────────────────────────────────────────────────────
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY partidos_select_authenticated ON partidos
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY partidos_insert_propio ON partidos
    FOR INSERT TO authenticated
    WITH CHECK (creador_id = auth.uid());

CREATE POLICY partidos_update_propio ON partidos
    FOR UPDATE TO authenticated
    USING (
        creador_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM parejas p
            WHERE p.id IN (partidos.pareja1_id, partidos.pareja2_id)
              AND (
                  p.jugador1_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
                  OR p.jugador2_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
              )
        )
        OR EXISTS (
            SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.id = partidos.club_id
        )
    )
    WITH CHECK (
        creador_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM parejas p
            WHERE p.id IN (partidos.pareja1_id, partidos.pareja2_id)
              AND (
                  p.jugador1_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
                  OR p.jugador2_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
              )
        )
        OR EXISTS (
            SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.id = partidos.club_id
        )
    );

-- Sin política de DELETE para `authenticated`: nada en la app borra
-- partidos con la sesión del usuario — siempre con service-role.
