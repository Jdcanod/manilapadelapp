-- Migración para añadir soporte a la confirmación de resultados de partidos de torneo por parte del oponente o club.

ALTER TABLE partidos 
ADD COLUMN IF NOT EXISTS estado_resultado text DEFAULT 'confirmado',
ADD COLUMN IF NOT EXISTS reportado_por_id uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS resultado_registrado_at timestamptz,
ADD COLUMN IF NOT EXISTS resultado_registrado_por uuid REFERENCES users(id),
ADD COLUMN IF NOT EXISTS resultado_confirmado_por uuid REFERENCES users(id);

-- Comentario: 
-- estado_resultado puede ser: 'pendiente_confirmacion', 'confirmado', 'disputado'
-- reportado_por_id: ID del usuario (jugador) que subió el score inicialmente.
