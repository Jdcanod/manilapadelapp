-- =====================================================================
-- Limpieza de invitados duplicados en `users`.
-- v6 — manejo robusto de UNIQUE en torneo_parejas y notices verbosos
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.norm_nombre(s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(lower(trim(coalesce(s, ''))), '\s+', ' ', 'g');
$$;

-- ========================
-- PASO 1: invitados canónicos
-- ========================
CREATE TEMP TABLE _invitados_canonical AS
WITH agrupados AS (
    SELECT id, pg_temp.norm_nombre(nombre || ' ' || coalesce(apellido, '')) AS key, fecha_registro
    FROM users
    WHERE rol = 'jugador' AND email LIKE 'invitado_%@manilapadel.app'
),
canon AS (
    SELECT key, id AS canon_id
    FROM (
        SELECT key, id, fecha_registro,
               ROW_NUMBER() OVER (PARTITION BY key ORDER BY fecha_registro ASC, id ASC) AS rn
        FROM agrupados
    ) t WHERE rn = 1
)
SELECT a.id AS dup_id, c.canon_id
FROM agrupados a JOIN canon c ON c.key = a.key
WHERE a.id <> c.canon_id;

DO $$
DECLARE n int;
BEGIN
    SELECT COUNT(*) INTO n FROM _invitados_canonical;
    RAISE NOTICE '[v6] PASO 1 listo: % users duplicados a fusionar', n;
END $$;

-- ========================
-- PASO 2: refs de usuarios en partidos
-- ========================
DO $$
DECLARE
    col text;
    cols text[] := ARRAY['resultado_propietario_id','reportado_por_id','resultado_confirmado_por','resultado_registrado_por'];
BEGIN
    FOREACH col IN ARRAY cols LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name=col) THEN
            EXECUTE format('UPDATE partidos p SET %1$I = m.canon_id FROM _invitados_canonical m WHERE p.%1$I = m.dup_id', col);
        END IF;
    END LOOP;
    RAISE NOTICE '[v6] PASO 2 listo: partidos.* redirigidos';
END $$;

-- ========================
-- PASO 3: inscripciones.admin_id
-- ========================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='inscripciones')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inscripciones' AND column_name='admin_id') THEN
        EXECUTE 'UPDATE inscripciones i SET admin_id = m.canon_id FROM _invitados_canonical m WHERE i.admin_id = m.dup_id';
    END IF;
    RAISE NOTICE '[v6] PASO 3 listo';
END $$;

-- ========================
-- PASO 4: parejas — dropear constraints
-- ========================
ALTER TABLE parejas DROP CONSTRAINT IF EXISTS parejas_jugador1_id_jugador2_id_key;
DROP INDEX IF EXISTS idx_jugador1_activo;
DROP INDEX IF EXISTS idx_jugador2_activo;
DO $$ BEGIN RAISE NOTICE '[v6] PASO 4a: constraints de parejas dropeados'; END $$;

-- 4b) update jugadorX_id al canónico (constraint dropeado, sin colisiones)
UPDATE parejas SET jugador1_id = m.canon_id FROM _invitados_canonical m WHERE parejas.jugador1_id = m.dup_id;
UPDATE parejas SET jugador2_id = m.canon_id FROM _invitados_canonical m WHERE parejas.jugador2_id = m.dup_id;
DO $$ BEGIN RAISE NOTICE '[v6] PASO 4b: jugadores en parejas redirigidos'; END $$;

-- 4c) Helper reusable: dedupea parejas usando una temp table de mapeo dup→canon,
-- manejando colisiones de UNIQUE(torneo_id, pareja_id) en torneo_parejas.
CREATE OR REPLACE FUNCTION pg_temp.aplicar_dedup_parejas(map_tabla text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    -- Borrar torneo_parejas (T, dup) donde (T, canon) ya existe — evita choque en UNIQUE
    EXECUTE format($f$
        DELETE FROM torneo_parejas tp_dup
        USING %1$I m
        WHERE tp_dup.pareja_id = m.dup_pareja_id
          AND EXISTS (
              SELECT 1 FROM torneo_parejas tp_canon
              WHERE tp_canon.pareja_id = m.canon_pareja_id
                AND tp_canon.torneo_id = tp_dup.torneo_id
          )
    $f$, map_tabla);

    -- Redirigir torneo_parejas restantes
    EXECUTE format($f$
        UPDATE torneo_parejas tp SET pareja_id = m.canon_pareja_id
        FROM %1$I m WHERE tp.pareja_id = m.dup_pareja_id
    $f$, map_tabla);

    -- Redirigir partidos.pareja1_id y pareja2_id (sin UNIQUE en estas columnas)
    EXECUTE format($f$
        UPDATE partidos p SET pareja1_id = m.canon_pareja_id
        FROM %1$I m WHERE p.pareja1_id = m.dup_pareja_id
    $f$, map_tabla);
    EXECUTE format($f$
        UPDATE partidos p SET pareja2_id = m.canon_pareja_id
        FROM %1$I m WHERE p.pareja2_id = m.dup_pareja_id
    $f$, map_tabla);

    -- Borrar duplicados sobrantes en torneo_parejas (por si quedaron)
    DELETE FROM torneo_parejas tp USING torneo_parejas tp2
    WHERE tp.id > tp2.id AND tp.torneo_id = tp2.torneo_id AND tp.pareja_id = tp2.pareja_id;

    -- Borrar las parejas duplicadas
    EXECUTE format($f$DELETE FROM parejas WHERE id IN (SELECT dup_pareja_id FROM %1$I)$f$, map_tabla);
END $$;

-- 4d) PASADA 1: dedup por (j1, j2) EXACTO
CREATE TEMP TABLE _parejas_canonical AS
WITH ord AS (
    SELECT id, jugador1_id, jugador2_id, creado_en,
           ROW_NUMBER() OVER (PARTITION BY jugador1_id, jugador2_id ORDER BY creado_en ASC NULLS LAST, id ASC) AS rn,
           FIRST_VALUE(id) OVER (PARTITION BY jugador1_id, jugador2_id ORDER BY creado_en ASC NULLS LAST, id ASC) AS canon_id
    FROM parejas WHERE jugador1_id IS NOT NULL AND jugador2_id IS NOT NULL
)
SELECT id AS dup_pareja_id, canon_id AS canon_pareja_id FROM ord WHERE rn > 1;

DO $$
DECLARE n int;
BEGIN
    SELECT COUNT(*) INTO n FROM _parejas_canonical;
    RAISE NOTICE '[v6] PASADA 1 (exacto): % parejas duplicadas a fusionar', n;
    PERFORM pg_temp.aplicar_dedup_parejas('_parejas_canonical');
END $$;

-- 4e) PASADA 2: dedup por (j1, j2) INVERTIDO ((X,Y) vs (Y,X))
CREATE TEMP TABLE _parejas_reversadas AS
WITH ord AS (
    SELECT id, jugador1_id, jugador2_id, creado_en,
           LEAST(jugador1_id::text, jugador2_id::text) AS a,
           GREATEST(jugador1_id::text, jugador2_id::text) AS b
    FROM parejas WHERE jugador1_id IS NOT NULL AND jugador2_id IS NOT NULL
),
canon AS (
    SELECT a, b, id AS canon_id FROM (
        SELECT a, b, id, creado_en,
               ROW_NUMBER() OVER (PARTITION BY a, b ORDER BY creado_en ASC NULLS LAST, id ASC) AS rn
        FROM ord
    ) t WHERE rn = 1
)
SELECT n.id AS dup_pareja_id, c.canon_id AS canon_pareja_id
FROM ord n JOIN canon c ON c.a = n.a AND c.b = n.b
WHERE n.id <> c.canon_id;

DO $$
DECLARE n int;
BEGIN
    SELECT COUNT(*) INTO n FROM _parejas_reversadas;
    RAISE NOTICE '[v6] PASADA 2 (invertido): % parejas duplicadas a fusionar', n;
    PERFORM pg_temp.aplicar_dedup_parejas('_parejas_reversadas');
END $$;

-- 4f) Diagnóstico ANTES de re-crear el constraint
DO $$
DECLARE n_dups int; sample text;
BEGIN
    SELECT COUNT(*), MIN(jugador1_id::text || ' / ' || jugador2_id::text) INTO n_dups, sample
    FROM (
        SELECT jugador1_id, jugador2_id, COUNT(*) c
        FROM parejas WHERE jugador1_id IS NOT NULL AND jugador2_id IS NOT NULL
        GROUP BY jugador1_id, jugador2_id HAVING COUNT(*) > 1
    ) x;

    IF n_dups > 0 THEN
        RAISE EXCEPTION '[v6] FALLO: aún quedan % grupos de parejas duplicadas. Ejemplo: %', n_dups, sample;
    ELSE
        RAISE NOTICE '[v6] PASO 4f: sin duplicados (j1, j2) — listo para recrear constraint';
    END IF;
END $$;

-- 4g) "1 pareja activa por jugador"
WITH activas AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY jugador1_id ORDER BY creado_en DESC NULLS LAST, id DESC) AS rn1,
           ROW_NUMBER() OVER (PARTITION BY jugador2_id ORDER BY creado_en DESC NULLS LAST, id DESC) AS rn2
    FROM parejas WHERE activa = TRUE
)
UPDATE parejas SET activa = FALSE
WHERE id IN (SELECT id FROM activas WHERE rn1 > 1 OR rn2 > 1);

-- 4h) Recrear constraint e índices
ALTER TABLE parejas ADD CONSTRAINT parejas_jugador1_id_jugador2_id_key UNIQUE (jugador1_id, jugador2_id);
CREATE UNIQUE INDEX idx_jugador1_activo ON parejas (jugador1_id) WHERE activa = TRUE;
CREATE UNIQUE INDEX idx_jugador2_activo ON parejas (jugador2_id) WHERE activa = TRUE;
DO $$ BEGIN RAISE NOTICE '[v6] PASO 4h: constraints recreados'; END $$;

-- ========================
-- PASO 5: borrar users duplicados
-- ========================
DELETE FROM users WHERE id IN (SELECT dup_id FROM _invitados_canonical);
DO $$ BEGIN RAISE NOTICE '[v6] PASO 5: users duplicados borrados'; END $$;

-- Resultado final
SELECT
    (SELECT COUNT(*) FROM _invitados_canonical) AS users_duplicados_borrados,
    (SELECT COUNT(*) FROM _parejas_canonical)   AS parejas_duplicadas_exactas_borradas,
    (SELECT COUNT(*) FROM _parejas_reversadas)  AS parejas_duplicadas_invertidas_borradas;

COMMIT;
