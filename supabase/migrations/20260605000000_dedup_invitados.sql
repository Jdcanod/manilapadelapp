-- =====================================================================
-- Limpieza de invitados duplicados en `users`.
--
-- Contexto: hasta este commit, cada vez que un admin inscribía una pareja
-- con un nombre tipo "manual:Juan Pérez", se creaba una NUEVA fila en
-- `users` con email único, sin buscar si ya existía un invitado con ese
-- mismo nombre. Eso generó duplicados.
--
-- Este script:
--   1. Identifica los invitados duplicados (mismo nombre+apellido, email
--      tipo 'invitado_%@manilapadel.app').
--   2. Elige una fila canónica por grupo (la más antigua).
--   3. Redirige TODAS las referencias (parejas, partidos, inscripciones)
--      hacia la fila canónica.
--   4. Borra los duplicados.
--
-- ¡IMPORTANTE! Ejecutar en el SQL Editor de Supabase como una sola
-- transacción. Antes hace un `SELECT` de preview para que veas qué se
-- va a tocar.
-- =====================================================================

BEGIN;

-- Helper de normalización (idempotente: se borra al final del bloque)
CREATE OR REPLACE FUNCTION pg_temp.norm_nombre(s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(lower(trim(coalesce(s, ''))), '\s+', ' ', 'g');
$$;

-- Paso 1: Construir la tabla de mapeo dup_id -> canon_id
CREATE TEMP TABLE _invitados_canonical AS
WITH agrupados AS (
    SELECT
        id,
        pg_temp.norm_nombre(nombre || ' ' || coalesce(apellido, '')) AS key,
        fecha_registro
    FROM users
    WHERE rol = 'jugador'
      AND email LIKE 'invitado_%@manilapadel.app'
),
canon AS (
    SELECT key, id AS canon_id
    FROM (
        SELECT
            key, id, fecha_registro,
            ROW_NUMBER() OVER (PARTITION BY key ORDER BY fecha_registro ASC, id ASC) AS rn
        FROM agrupados
    ) t
    WHERE rn = 1
)
SELECT a.id AS dup_id, c.canon_id
FROM agrupados a
JOIN canon c ON c.key = a.key
WHERE a.id <> c.canon_id;

-- Preview: cuántos duplicados vamos a eliminar
SELECT COUNT(*) AS duplicados_a_eliminar FROM _invitados_canonical;

-- Paso 2: Redirigir referencias en `partidos` (columnas de usuario).
-- Algunas columnas pueden no existir en bases que no aplicaron todas las
-- migraciones, así que las redirigimos sólo si existen.
DO $$
DECLARE
    col text;
    cols text[] := ARRAY[
        'resultado_propietario_id',
        'reportado_por_id',
        'resultado_confirmado_por',
        'resultado_registrado_por'
    ];
BEGIN
    FOREACH col IN ARRAY cols LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'partidos' AND column_name = col
        ) THEN
            EXECUTE format(
                'UPDATE partidos p SET %1$I = m.canon_id
                 FROM _invitados_canonical m
                 WHERE p.%1$I = m.dup_id',
                col
            );
        END IF;
    END LOOP;
END $$;

-- Paso 3: Redirigir referencias en `inscripciones` (solo si existe)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'inscripciones'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inscripciones' AND column_name = 'admin_id'
    ) THEN
        EXECUTE 'UPDATE inscripciones i
                 SET admin_id = m.canon_id
                 FROM _invitados_canonical m
                 WHERE i.admin_id = m.dup_id';
    END IF;
END $$;

-- Paso 4: Manejar `parejas`.
-- Estrategia: dropeamos temporalmente el constraint UNIQUE(jugador1_id, jugador2_id)
-- y los índices únicos parciales en (jugador*_id) WHERE activa=TRUE, hacemos
-- TODOS los updates sin restricciones, dedupeamos el estado final, y re-creamos.
-- Esto es mucho más robusto que tratar de predecir colisiones.

-- 4a) Soltar constraint e índices únicos
ALTER TABLE parejas DROP CONSTRAINT IF EXISTS parejas_jugador1_id_jugador2_id_key;
DROP INDEX IF EXISTS idx_jugador1_activo;
DROP INDEX IF EXISTS idx_jugador2_activo;

-- 4b) Apuntar jugador1_id / jugador2_id al canónico libremente
UPDATE parejas
SET jugador1_id = m.canon_id
FROM _invitados_canonical m
WHERE parejas.jugador1_id = m.dup_id;

UPDATE parejas
SET jugador2_id = m.canon_id
FROM _invitados_canonical m
WHERE parejas.jugador2_id = m.dup_id;

-- 4c) PASADA 1: Dedup por tuple EXACTO (j1, j2). Esto es lo que el constraint
-- UNIQUE va a chequear cuando lo recreamos en 4h, así que arrancamos por aquí.
CREATE TEMP TABLE _parejas_canonical AS
WITH ord AS (
    SELECT id, jugador1_id, jugador2_id, creado_en,
           ROW_NUMBER() OVER (
               PARTITION BY jugador1_id, jugador2_id
               ORDER BY creado_en ASC NULLS LAST, id ASC
           ) AS rn,
           FIRST_VALUE(id) OVER (
               PARTITION BY jugador1_id, jugador2_id
               ORDER BY creado_en ASC NULLS LAST, id ASC
           ) AS canon_id
    FROM parejas
    WHERE jugador1_id IS NOT NULL AND jugador2_id IS NOT NULL
)
SELECT id AS dup_pareja_id, canon_id AS canon_pareja_id
FROM ord WHERE rn > 1;

UPDATE torneo_parejas tp
SET pareja_id = m.canon_pareja_id
FROM _parejas_canonical m
WHERE tp.pareja_id = m.dup_pareja_id;

UPDATE partidos p
SET pareja1_id = m.canon_pareja_id
FROM _parejas_canonical m
WHERE p.pareja1_id = m.dup_pareja_id;

UPDATE partidos p
SET pareja2_id = m.canon_pareja_id
FROM _parejas_canonical m
WHERE p.pareja2_id = m.dup_pareja_id;

DELETE FROM torneo_parejas tp
USING torneo_parejas tp2
WHERE tp.id > tp2.id
  AND tp.torneo_id = tp2.torneo_id
  AND tp.pareja_id = tp2.pareja_id;

DELETE FROM parejas
WHERE id IN (SELECT dup_pareja_id FROM _parejas_canonical);

-- 4d) PASADA 2: Dedup por tuple INVERTIDO (X, Y) vs (Y, X). UNIQUE permite ambos
-- ordered tuples como distintos, pero para limpieza lógica los fusionamos.
CREATE TEMP TABLE _parejas_reversadas AS
WITH ord AS (
    SELECT id, jugador1_id, jugador2_id, creado_en,
           LEAST(jugador1_id::text, jugador2_id::text) AS a,
           GREATEST(jugador1_id::text, jugador2_id::text) AS b
    FROM parejas
    WHERE jugador1_id IS NOT NULL AND jugador2_id IS NOT NULL
),
canon AS (
    SELECT a, b, id AS canon_id
    FROM (
        SELECT a, b, id, creado_en,
               ROW_NUMBER() OVER (PARTITION BY a, b ORDER BY creado_en ASC NULLS LAST, id ASC) AS rn
        FROM ord
    ) t WHERE rn = 1
)
SELECT n.id AS dup_pareja_id, c.canon_id AS canon_pareja_id
FROM ord n
JOIN canon c ON c.a = n.a AND c.b = n.b
WHERE n.id <> c.canon_id;

UPDATE torneo_parejas tp
SET pareja_id = m.canon_pareja_id
FROM _parejas_reversadas m
WHERE tp.pareja_id = m.dup_pareja_id;

UPDATE partidos p
SET pareja1_id = m.canon_pareja_id
FROM _parejas_reversadas m
WHERE p.pareja1_id = m.dup_pareja_id;

UPDATE partidos p
SET pareja2_id = m.canon_pareja_id
FROM _parejas_reversadas m
WHERE p.pareja2_id = m.dup_pareja_id;

DELETE FROM torneo_parejas tp
USING torneo_parejas tp2
WHERE tp.id > tp2.id
  AND tp.torneo_id = tp2.torneo_id
  AND tp.pareja_id = tp2.pareja_id;

DELETE FROM parejas
WHERE id IN (SELECT dup_pareja_id FROM _parejas_reversadas);

-- 4e) Diagnóstico: si todavía quedan duplicados exactos, abortamos con un mensaje claro.
DO $$
DECLARE
    n_dups int;
    sample text;
BEGIN
    SELECT COUNT(*), MIN(jugador1_id || ' / ' || jugador2_id)
    INTO n_dups, sample
    FROM (
        SELECT jugador1_id, jugador2_id, COUNT(*) c
        FROM parejas
        WHERE jugador1_id IS NOT NULL AND jugador2_id IS NOT NULL
        GROUP BY jugador1_id, jugador2_id
        HAVING COUNT(*) > 1
    ) x;

    IF n_dups > 0 THEN
        RAISE EXCEPTION 'Aún quedan % grupos de parejas con (j1, j2) duplicado. Ejemplo: %', n_dups, sample;
    END IF;
END $$;

-- 4g) Asegurar que sólo quede UNA pareja activa por (jugador1_id) y (jugador2_id).
-- Si hay varias activas para el mismo jugador después de la limpieza, dejamos
-- activa la más reciente y las otras pasan a activa=FALSE.
WITH activas AS (
    SELECT id, jugador1_id, jugador2_id, creado_en,
           ROW_NUMBER() OVER (PARTITION BY jugador1_id ORDER BY creado_en DESC NULLS LAST, id DESC) AS rn1,
           ROW_NUMBER() OVER (PARTITION BY jugador2_id ORDER BY creado_en DESC NULLS LAST, id DESC) AS rn2
    FROM parejas WHERE activa = TRUE
)
UPDATE parejas SET activa = FALSE
WHERE id IN (SELECT id FROM activas WHERE rn1 > 1 OR rn2 > 1);

-- 4h) Recrear constraint y los índices parciales
ALTER TABLE parejas
    ADD CONSTRAINT parejas_jugador1_id_jugador2_id_key UNIQUE (jugador1_id, jugador2_id);
CREATE UNIQUE INDEX idx_jugador1_activo ON parejas (jugador1_id) WHERE activa = TRUE;
CREATE UNIQUE INDEX idx_jugador2_activo ON parejas (jugador2_id) WHERE activa = TRUE;

-- Paso 5: Borrar las filas users duplicadas
DELETE FROM users
WHERE id IN (SELECT dup_id FROM _invitados_canonical);

-- Confirmación final
SELECT
    (SELECT COUNT(*) FROM _invitados_canonical) AS users_duplicados_borrados,
    (SELECT COUNT(*) FROM _parejas_canonical)   AS parejas_duplicadas_borradas;

COMMIT;
