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

-- Paso 2: Redirigir referencias en `partidos` (columnas de usuario)
UPDATE partidos p
SET resultado_propietario_id = m.canon_id
FROM _invitados_canonical m
WHERE p.resultado_propietario_id = m.dup_id;

UPDATE partidos p
SET reportado_por_id = m.canon_id
FROM _invitados_canonical m
WHERE p.reportado_por_id = m.dup_id;

UPDATE partidos p
SET resultado_confirmado_por = m.canon_id
FROM _invitados_canonical m
WHERE p.resultado_confirmado_por = m.dup_id;

UPDATE partidos p
SET resultado_registrado_por = m.canon_id
FROM _invitados_canonical m
WHERE p.resultado_registrado_por = m.dup_id;

-- Paso 3: Redirigir referencias en `inscripciones`
UPDATE inscripciones i
SET admin_id = m.canon_id
FROM _invitados_canonical m
WHERE i.admin_id = m.dup_id;

-- Paso 4: Manejar `parejas` con cuidado por el constraint UNIQUE(jugador1_id, jugador2_id)
-- y por los índices únicos parciales en (jugador*_id) WHERE activa = TRUE.
-- Estrategia:
--   a) Desactivar TODAS las parejas que tengan a un duplicado para liberar índices.
--   b) Apuntar jugador1_id / jugador2_id al canónico.
--   c) Si quedaron parejas duplicadas (mismo j1+j2 normalizado), fusionarlas:
--      - apuntar `torneo_parejas` y `partidos` (pareja1_id, pareja2_id) a la
--        pareja canónica (la más antigua) y borrar las otras.

UPDATE parejas
SET activa = FALSE
WHERE jugador1_id IN (SELECT dup_id FROM _invitados_canonical)
   OR jugador2_id IN (SELECT dup_id FROM _invitados_canonical);

UPDATE parejas
SET jugador1_id = m.canon_id
FROM _invitados_canonical m
WHERE parejas.jugador1_id = m.dup_id;

UPDATE parejas
SET jugador2_id = m.canon_id
FROM _invitados_canonical m
WHERE parejas.jugador2_id = m.dup_id;

-- Fusionar parejas que ahora tienen el mismo (j1, j2) (o invertido)
CREATE TEMP TABLE _parejas_canonical AS
WITH normalizadas AS (
    SELECT
        id,
        LEAST(jugador1_id::text, jugador2_id::text) AS a,
        GREATEST(jugador1_id::text, jugador2_id::text) AS b,
        creado_en
    FROM parejas
    WHERE jugador1_id IS NOT NULL AND jugador2_id IS NOT NULL
),
canon AS (
    SELECT a, b, id AS canon_id
    FROM (
        SELECT
            a, b, id, creado_en,
            ROW_NUMBER() OVER (PARTITION BY a, b ORDER BY creado_en ASC, id ASC) AS rn
        FROM normalizadas
    ) t
    WHERE rn = 1
)
SELECT n.id AS dup_pareja_id, c.canon_id AS canon_pareja_id
FROM normalizadas n
JOIN canon c ON c.a = n.a AND c.b = n.b
WHERE n.id <> c.canon_id;

-- Redirigir torneo_parejas
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

-- Borrar parejas duplicadas (después de redirigir todas las refs)
DELETE FROM parejas
WHERE id IN (SELECT dup_pareja_id FROM _parejas_canonical);

-- Eliminar duplicados de torneo_parejas (mismo torneo + misma pareja)
DELETE FROM torneo_parejas tp
USING torneo_parejas tp2
WHERE tp.id > tp2.id
  AND tp.torneo_id = tp2.torneo_id
  AND tp.pareja_id = tp2.pareja_id;

-- Paso 5: Borrar las filas users duplicadas
DELETE FROM users
WHERE id IN (SELECT dup_id FROM _invitados_canonical);

-- Confirmación final
SELECT
    (SELECT COUNT(*) FROM _invitados_canonical) AS users_duplicados_borrados,
    (SELECT COUNT(*) FROM _parejas_canonical)   AS parejas_duplicadas_borradas;

COMMIT;
