-- ==========================================
-- ManilaPadelAPP - Esquema Inicial de Base de Datos
-- ==========================================

-- Extensión necesaria para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types para restringir valores de dominio
CREATE TYPE user_role AS ENUM ('jugador', 'admin_club', 'superadmin');
CREATE TYPE user_level AS ENUM ('amateur', 'intermedio', 'avanzado');
CREATE TYPE match_status AS ENUM ('pendiente', 'confirmado_p1', 'confirmado_p2', 'completado_validado');

-- 1. Tabla de Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE, -- Foreign Key opcional hacia auth.users de Supabase
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    foto TEXT,
    bio TEXT,
    ciudad VARCHAR(100) DEFAULT 'Manizales',
    nivel user_level DEFAULT 'amateur',
    rol user_role DEFAULT 'jugador',
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Clubes
CREATE TABLE clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    nombre VARCHAR(255) NOT NULL,
    fotos TEXT[], -- Array de URLs de fotos
    descripcion TEXT,
    direccion VARCHAR(255),
    canchas_disponibles INT DEFAULT 1,
    horarios JSONB, -- Estructura: {"lunes": {"apertura": "08:00", "cierre": "22:00"}}
    ciudad VARCHAR(100) DEFAULT 'Manizales',
    verificado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de Parejas (Ranking)
CREATE TABLE parejas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jugador1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    jugador2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    nombre_pareja VARCHAR(255),
    puntos_ranking INT DEFAULT 1200, -- Puntaje base ELO
    ciudad VARCHAR(100) DEFAULT 'Manizales',
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Constraint: Un jugador no puede estar activo en varias parejas a la vez (por ciudad se podría hacer compuesto)
    -- Lo dejamos manejado por triggers / lógica de negocio, o con indices parciales.
    UNIQUE(jugador1_id, jugador2_id)
);

-- Índice parcial para garantizar 1 pareja activa por jugador
CREATE UNIQUE INDEX idx_jugador1_activo ON parejas (jugador1_id) WHERE activa = TRUE;
CREATE UNIQUE INDEX idx_jugador2_activo ON parejas (jugador2_id) WHERE activa = TRUE;

-- 4. Tabla de Partido
CREATE TABLE partidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pareja1_id UUID REFERENCES parejas(id) ON DELETE SET NULL,
    pareja2_id UUID REFERENCES parejas(id) ON DELETE SET NULL,
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    cancha_id VARCHAR(50), -- Opcional, nombre o numero de la cancha dentro del club
    fecha TIMESTAMP WITH TIME ZONE NOT NULL,
    resultado VARCHAR(100), -- Formato ejemplo: "6-4, 4-6, 7-6"
    estado match_status DEFAULT 'pendiente',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla de Torneos
CREATE TABLE torneos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    fecha_inicio TIMESTAMP WITH TIME ZONE,
    fecha_fin TIMESTAMP WITH TIME ZONE,
    formato VARCHAR(100),
    participantes JSONB DEFAULT '[]'::jsonb, -- Array de IDs de parejas o users
    resultados JSONB DEFAULT '{}'::jsonb,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Triggers y Policies (Row Level Security) opcionales irían aquí, pero la lógica fuerte
-- se gestionará desde el backend / middleware para facilitar el desarrollo rápido de este MVP.

-- Trigger para updated_at en tabla `partidos`
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_update_partidos_modified
BEFORE UPDATE ON partidos
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
