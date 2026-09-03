-- ─────────────────────────────────────────────────────────────────────────────
-- Amistosos: cimientos (Fase A)
--
-- Contexto del estado encontrado en producción antes de esta migración:
--   * El flujo de amistosos estaba roto de punta a punta: 1 solo amistoso
--     creado en toda la historia de la app (cancelado) y 0 filas en
--     `partido_jugadores` — nadie se unió nunca a uno.
--   * `partidos.tipo_partido` (default 'Amistoso') y `partidos.tipo_partido_oficial`
--     (default 'amistoso') son INSERVIBLES como discriminador: los ~664 partidos
--     de torneo existentes heredaron ese default. El discriminador confiable es
--     `torneo_id IS NULL`.
--   * `partidos.nivel` mezclaba dos vocabularios: las categorías reales del
--     ranking ('4ta','5ta','6ta','7ma') en torneos, y etiquetas sueltas del
--     dialog de amistosos ('intermedio'). A partir de aquí los amistosos usan
--     la MISMA escala de categorías, para poder calcular "categorías cercanas".
--
-- Nota: las migraciones de este repo están desincronizadas del esquema real
-- (p.ej. initial_schema declara `estado match_status` como enum, pero en
-- producción es `text` con default 'abierto', y le faltan casi todas las
-- columnas de amistosos). Por eso todo aquí va con IF NOT EXISTS y sin asumir
-- tipos previos.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Qué tan abierto deja el creador su partido a otras categorías.
--    0 = solo la misma categoría · 1 = ±1 categoría · 9 = abierto a todas
--    (ver RANGO en src/lib/amistosos/index.ts)
ALTER TABLE partidos
    ADD COLUMN IF NOT EXISTS categoria_rango SMALLINT DEFAULT 1;

COMMENT ON COLUMN partidos.categoria_rango IS
    'Solo amistosos (torneo_id IS NULL). 0=misma categoria, 1=+-1 categoria, 9=abierto a todas. Ver src/lib/amistosos.';

COMMENT ON COLUMN partidos.nivel IS
    'Categoria del partido en la escala del ranking: 4ta/5ta/6ta/7ma. Datos historicos pueden traer etiquetas viejas (intermedio, Suma 11, Damas).';

-- 2. Índice para la lista de amistosos vigentes de la comunidad, que consulta
--    por `torneo_id IS NULL` + estado + fecha futura.
CREATE INDEX IF NOT EXISTS idx_partidos_amistosos_fecha
    ON partidos (fecha)
    WHERE torneo_id IS NULL;

-- 3. El único amistoso histórico quedó con nivel 'intermedio' (escala vieja) y
--    ya está cancelado — no se toca, queda como registro histórico.
