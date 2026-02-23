-- ==========================================
-- ManilaPadelAPP - Migración Torneos y Rankings
-- ==========================================

-- 0. Crear tablas base (por si no fueron creadas en migraciones anteriores)
CREATE TABLE IF NOT EXISTS parejas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jugador1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    jugador2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nombre_pareja VARCHAR(255),
    puntos_ranking INT DEFAULT 1200, 
    ciudad VARCHAR(100) DEFAULT 'Manizales',
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(jugador1_id, jugador2_id)
);

CREATE TABLE IF NOT EXISTS torneos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    formato VARCHAR(100),
    participantes JSONB DEFAULT '[]'::jsonb,
    resultados JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Crear tabla torneo_parejas (Inscripciones de parejas a un torneo)
CREATE TABLE IF NOT EXISTS torneo_parejas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    torneo_id UUID REFERENCES torneos(id) ON DELETE CASCADE,
    pareja_id UUID REFERENCES parejas(id) ON DELETE CASCADE,
    categoria VARCHAR(50), -- Ej: "3ra", "4ta", "Damas 6ta"
    estado_pago VARCHAR(50) DEFAULT 'pendiente', -- pendiente, pagado
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(torneo_id, pareja_id)
);

-- 2. Crear tabla torneo_fases (Estructura de llaves o grupos en un torneo)
CREATE TABLE IF NOT EXISTS torneo_fases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    torneo_id UUID REFERENCES torneos(id) ON DELETE CASCADE,
    tipo_fase VARCHAR(50), -- 'grupo', 'eliminatoria_directa'
    nombre_fase VARCHAR(100), -- 'Grupo A', 'Cuartos de Final', 'Final'
    orden INT, -- Para saber qué fase sigue después de otra
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Modificaciones a la tabla `partidos` para vinculación con torneos y formato oficial vs amistoso
DO $$ 
BEGIN 
    -- Verificar si existe torneo_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='torneo_id') THEN
        ALTER TABLE partidos ADD COLUMN torneo_id UUID REFERENCES torneos(id) ON DELETE CASCADE;
    END IF;

    -- Verificar si existe torneo_fase_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='torneo_fase_id') THEN
        ALTER TABLE partidos ADD COLUMN torneo_fase_id UUID REFERENCES torneo_fases(id) ON DELETE SET NULL;
    END IF;

    -- Verificar si existe tipo_partido (y si ya está, alterar su lógica si fuese necesario, pero en nuestro base asumo que era string si existe).
    -- Aquí lo tratamos como varchar(50) por convención rápida.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='tipo_partido_oficial') THEN
        ALTER TABLE partidos ADD COLUMN tipo_partido_oficial VARCHAR(50) DEFAULT 'amistoso';
    END IF;
    
    -- Agregar columnas para la doble validación del score, que pidio el cliente:
    -- resultado_subido_por_id: ID del usuario (o pareja) que propuso el resultado.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='resultado_propietario_id') THEN
        ALTER TABLE partidos ADD COLUMN resultado_propietario_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Soporte global para ranking de jugadores basado en ELO
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='puntos_ranking') THEN
        ALTER TABLE users ADD COLUMN puntos_ranking INT DEFAULT 1000;
    END IF;
END $$;
