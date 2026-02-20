-- ==========================================
-- ManilaPadelAPP - Datos de Prueba (Seed) 
-- Localidad: Manizales, Colombia
-- ==========================================

-- 1. Insertando Usuarios Base (3 Jugadores, 1 Admin de Club, 1 Super Admin)
INSERT INTO users (id, auth_id, nombre, email, bio, nivel, rol) VALUES
('11111111-1111-1111-1111-111111111111', NULL, 'Admin Felipe', 'admin@manilapadel.com', 'Superadministrador del sistema.', 'avanzado', 'superadmin'),
('22222222-2222-2222-2222-222222222222', NULL, 'Club Owner Manizales', 'club@manilapadel.com', 'Administrador de Manila Club Series.', 'intermedio', 'admin_club'),
('33333333-3333-3333-3333-333333333333', NULL, 'Andrés Jugador 1', 'andres@ejemplo.com', 'Jugador de revés agresivo.', 'avanzado', 'jugador'),
('44444444-4444-4444-4444-444444444444', NULL, 'Carlos Jugador 2', 'carlos@ejemplo.com', 'Sólido defensivo de derecha.', 'intermedio', 'jugador'),
('55555555-5555-5555-5555-555555555555', NULL, 'Diana Jugadora 3', 'diana@ejemplo.com', 'Le gusta usar paredes.', 'amateur', 'jugador'),
('66666666-6666-6666-6666-666666666666', NULL, 'Esteban Jugador 4', 'esteban@ejemplo.com', 'Precisión en los globos.', 'amateur', 'jugador');

-- 2. Insertando un par de Clubes en Manizales
INSERT INTO clubs (id, admin_id, nombre, descripcion, direccion, canchas_disponibles, verificado, horarios) VALUES
('aaaa1111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Manizales Padel Central', 'El club principal ubicado cerca al Cable. Canchas panorámicas full equipadas.', 'Calle 65 # 23-44, Sector El Cable', 4, TRUE, '{"lunes":{"a":"06:00","c":"23:00"}, "martes":{"a":"06:00","c":"23:00"}}'),
('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Bosque Padel', 'Rodeado de naturaleza cerca a Villamaría. Excelente ambiente familiar.', 'Km 2 Vía Villamaría', 2, TRUE, '{"lunes":{"a":"08:00","c":"20:00"}}');

-- 3. Crear algunas Parejas (Ranking)
INSERT INTO parejas (id, jugador1_id, jugador2_id, nombre_pareja, puntos_ranking) VALUES
('cccc3333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'Los Paisas Pro', 1450),
('dddd4444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', 'Team Montaña', 1100);

-- 4. Partidos Simificados (Ya completados)
INSERT INTO partidos (id, pareja1_id, pareja2_id, club_id, fecha, resultado, estado) VALUES
('eeee5555-5555-5555-5555-555555555555', 'cccc3333-3333-3333-3333-333333333333', 'dddd4444-4444-4444-4444-444444444444', 'aaaa1111-1111-1111-1111-111111111111', '2026-02-19 18:00:00+00', '6-2, 6-4', 'completado_validado');
