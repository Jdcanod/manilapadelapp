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

-- Paso 4: Manejar `parejas` con cuidado por el constraint UNIQUE(jugador1_id, jugador2_id)
-- y por los índices únicos parciales en (jugador*_id) WHERE activa = TRUE.
-- Estrategia:
--   a) Detectar parejas que *después* del redirect colisionarán y fusionarlas
--      ANTES de tocar jugador1_id / jugador2_id (esto evita violar el UNIQUE).
--   b) Desactivar las parejas restantes para liberar los índices parciales.
--   c) Apuntar jugador1_id / jugador2_id al canónico.

-- a) Proyectar el (j1, j2) futuro de cada pareja y elegir canónica por grupo.
CREATE TEMP TABLE _parejas_canonical AS
WITH proyectadas AS (
    SELECT
        p.id,
        p.creado_en,
        COALESCE(im1.canon_id, p.jugador1_id) AS j1_canon,
        COALESCE(im2.canon_id, p.jugador2_id) AS j2_canon
    FROM parejas p
    LEFT JOIN _invitados_canonical im1 ON im1.dup_id = p.jugador1_id
    LEFT JOIN _invitados_canonical im2 ON im2.dup_id = p.jugador2_id
    WHERE p.jugador1_id IS NOT NULL AND p.jugador2_id IS NOT NULL
),
normalizadas AS (
    SELECT
        id, creado_en,
        LEAST(j1_canon::text, j2_canon::text) AS a,
        GREATEST(j1_canon::text, j2_canon::text) AS b
    FROM proyectadas
),
canon AS (
    SELECT a, b, id AS canon_id
    FROM (
        SELECT a, b, id, creado_en,
               ROW_NUMBER() OVER (PARTITION BY a, b ORDER BY creado_en ASC, id ASC) AS rn
        FROM normalizadas
    ) t
    WHERE rn = 1
)
SELECT n.id AS dup_pareja_id, c.canon_id AS canon_pareja_id
FROM normalizadas n
JOIN canon c ON c.a = n.a AND c.b = n.b
WHERE n.id <> c.canon_id;

-- Redirigir torneo_parejas a la pareja canónica ANTES de borrar duplicados
UPDATE torneo_parejas tp
SET pareja_id = m.canon_pareja_id
FROM _parejas_canonical m
WHERE tp.pareja_id = m.dup_pareja_id;

-- Redirigir partidos.pareja1_id / pareja2_id
UPDATE partidos p
SET pareja1_id = m.canon_pareja_id
FROM _parejas_canonical m
WHERE p.pareja1_id = m.dup_pareja_id;

UPDATE partidos p
SET pareja2_id = m.canon_pareja_id
FROM _parejas_canonical m
WHERE p.pareja2_id = m.dup_pareja_id;

-- Eliminar duplicados de torneo_parejas (mismo torneo + misma pareja)
DELETE FROM torneo_parejas tp
USING torneo_parejas tp2
WHERE tp.id > tp2.id
  AND tp.torneo_id = tp2.torneo_id
  AND tp.pareja_id = tp2.pareja_id;

-- Borrar parejas duplicadas (ya nadie las referencia)
DELETE FROM parejas
WHERE id IN (SELECT dup_pareja_id FROM _parejas_canonical);

-- b) Desactivar las parejas restantes que apunten a un duplicado, para
-- liberar los índices únicos parciales antes del UPDATE final.
UPDATE parejas
SET activa = FALSE
WHERE jugador1_id IN (SELECT dup_id FROM _invitados_canonical)
   OR jugador2_id IN (SELECT dup_id FROM _invitados_canonical);

-- c) Ahora sí, redirigir jugador1_id / jugador2_id al canónico.
-- Ya no puede colisionar con UNIQUE(jugador1_id, jugador2_id) porque
-- las parejas que iban a colisionar las eliminamos arriba.
UPDATE parejas
SET jugador1_id = m.canon_id
FROM _invitados_canonical m
WHERE parejas.jugador1_id = m.dup_id;

UPDATE parejas
SET jugador2_id = m.canon_id
FROM _invitados_canonical m
WHERE parejas.jugador2_id = m.dup_id;

-- Paso 5: Borrar las filas users duplicadas
DELETE FROM users
WHERE id IN (SELECT dup_id FROM _invitados_canonical);

-- Confirmación final
SELECT
    (SELECT COUNT(*) FROM _invitados_canonical) AS users_duplicados_borrados,
    (SELECT COUNT(*) FROM _parejas_canonical)   AS parejas_duplicadas_borradas;

COMMIT;
