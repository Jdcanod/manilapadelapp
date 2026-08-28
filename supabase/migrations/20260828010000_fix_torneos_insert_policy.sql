-- ==========================================
-- Fix: política torneos_insert_own_club referenciaba club_id ambiguo
-- ==========================================
-- `users` tiene su propia columna club_id (la usada para asignar el club de
-- un jugador, ver superadmin/jugadores/actions.ts). La política original no
-- calificaba `club_id` con el nombre de la tabla, así que dentro del
-- EXISTS(SELECT ... FROM users u ...) Postgres lo resolvía contra
-- `u.club_id` (columna de la propia subquery) en vez de la fila nueva de
-- `torneos` que se está insertando — dejando la política efectivamente rota
-- (bloqueaba TODOS los inserts de torneos, incluso los legítimos).

DROP POLICY IF EXISTS torneos_insert_own_club ON torneos;

CREATE POLICY torneos_insert_own_club ON torneos
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid() AND u.id = torneos.club_id AND u.rol = 'admin_club'
        )
    );
