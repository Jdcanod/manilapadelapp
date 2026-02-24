-- ==========================================
-- ManilaPadelAPP - Simulación de Torneo Avanzado (v2)
-- Propósito: Crear 10 jugadores, 5 parejas, 1 torneo y partidos simulados
-- Categoría: 4ta
-- Localidad: Manizales, Colombia
-- ==========================================

DO $$
DECLARE
    v_club_id UUID;
    v_torneo_id UUID;
    v_fase_id UUID;
    v_p_ids UUID[] := '{}';
    v_pareja_ids UUID[] := '{}';
    v_nombres TEXT[] := ARRAY['Juan Pérez', 'Mateo Gómez', 'Santi Cano', 'Luis Arias', 'Felipe Ríos', 'Jorge Ruiz', 'Daniel Marín', 'Camilo Jaramillo', 'Andrés Henao', 'Sebastián Ortiz'];
    v_emails TEXT[] := ARRAY['juan@test.com', 'mateo@test.com', 'santi@test.com', 'luis@test.com', 'felipe@test.com', 'jorge@test.com', 'daniel@test.com', 'camilo@test.com', 'andres@test.com', 'sebastian@test.com'];
    v_puntos_base INT[] := ARRAY[1150, 1220, 1080, 1310, 1190, 1250, 1100, 1280, 1160, 1210];
    i INT;
    temp_id UUID;
BEGIN
    -- 1. Obtener un Club existente (Manizales Padel Central)
    SELECT id INTO v_club_id FROM clubs WHERE nombre = 'Manizales Padel Central' LIMIT 1;
    
    IF v_club_id IS NULL THEN
        -- Si no existe, usamos el primer club disponible
        SELECT id INTO v_club_id FROM clubs LIMIT 1;
    END IF;

    IF v_club_id IS NULL THEN
        -- Si aún no hay clubes, crear uno
        INSERT INTO clubs (nombre, direccion, canchas_disponibles, verificado)
        VALUES ('Club de Pruebas Manizales', 'Carrera 23 # 45-67', 4, TRUE)
        RETURNING id INTO v_club_id;
    END IF;

    -- 2. Crear 10 Jugadores
    FOR i IN 1..10 LOOP
        -- Verificar si el email ya existe para evitar errores en re-ejecución
        SELECT id INTO temp_id FROM users WHERE email = v_emails[i];
        
        IF temp_id IS NULL THEN
            INSERT INTO users (nombre, email, nivel, rol, puntos_ranking, ciudad)
            VALUES (v_nombres[i], v_emails[i], 'intermedio', 'jugador', v_puntos_base[i], 'Manizales')
            RETURNING id INTO temp_id;
        END IF;
        v_p_ids := array_append(v_p_ids, temp_id);
    END LOOP;

    -- 3. Crear 5 Parejas
    FOR i IN 1..5 LOOP
        -- Verificar si la pareja ya existe
        SELECT id INTO temp_id FROM parejas 
        WHERE (jugador1_id = v_p_ids[(i*2)-1] AND jugador2_id = v_p_ids[i*2])
           OR (jugador1_id = v_p_ids[i*2] AND jugador2_id = v_p_ids[(i*2)-1]);
        
        IF temp_id IS NULL THEN
            INSERT INTO parejas (jugador1_id, jugador2_id, nombre_pareja, puntos_ranking, ciudad, activa)
            VALUES (v_p_ids[(i*2)-1], v_p_ids[i*2], v_nombres[(i*2)-1] || ' & ' || v_nombres[i*2], v_puntos_base[(i*2)-1] + v_puntos_base[i*2], 'Manizales', TRUE)
            RETURNING id INTO temp_id;
        END IF;
        v_pareja_ids := array_append(v_pareja_ids, temp_id);
    END LOOP;

    -- 4. Crear un Torneo "Manizales Open - 4ta Categoría"
    INSERT INTO torneos (club_id, nombre, fecha_inicio, fecha_fin, formato, participantes)
    VALUES (v_club_id, 'Copa Testing 4ta - ' || to_char(NOW(), 'DD Mon'), NOW() - INTERVAL '5 days', NOW() + INTERVAL '5 days', 'Grupos + Eliminatoria', '[]'::jsonb)
    RETURNING id INTO v_torneo_id;

    -- 5. Inscribir las Parejas en el Torneo
    FOR i IN 1..5 LOOP
        INSERT INTO torneo_parejas (torneo_id, pareja_id, categoria, estado_pago)
        VALUES (v_torneo_id, v_pareja_ids[i], '4ta', 'pagado')
        ON CONFLICT (torneo_id, pareja_id) DO NOTHING;
    END LOOP;

    -- 6. Crear una Fase de Grupos
    INSERT INTO torneo_fases (torneo_id, tipo_fase, nombre_fase, orden)
    VALUES (v_torneo_id, 'grupo', 'Fase de Clasificación', 1)
    RETURNING id INTO v_fase_id;

    -- 7. Crear Partidos Simulados (Ya jugados)
    -- Partido 1: Pareja 1 vs Pareja 2
    INSERT INTO partidos (pareja1_id, pareja2_id, club_id, fecha, resultado, estado, torneo_id, torneo_fase_id, tipo_partido_oficial)
    VALUES (v_pareja_ids[1], v_pareja_ids[2], v_club_id, NOW() - INTERVAL '3 days', '6-4, 7-5', 'completado_validado', v_torneo_id, v_fase_id, 'oficial_torneo');

    -- Partido 2: Pareja 3 vs Pareja 4
    INSERT INTO partidos (pareja1_id, pareja2_id, club_id, fecha, resultado, estado, torneo_id, torneo_fase_id, tipo_partido_oficial)
    VALUES (v_pareja_ids[3], v_pareja_ids[4], v_club_id, NOW() - INTERVAL '2 days', '2-6, 6-3, 10-8', 'completado_validado', v_torneo_id, v_fase_id, 'oficial_torneo');

    -- Partido 3: Pareja 5 vs Pareja 1
    INSERT INTO partidos (pareja1_id, pareja2_id, club_id, fecha, resultado, estado, torneo_id, torneo_fase_id, tipo_partido_oficial)
    VALUES (v_pareja_ids[5], v_pareja_ids[1], v_club_id, NOW() - INTERVAL '1 day', '6-1, 6-2', 'completado_validado', v_torneo_id, v_fase_id, 'oficial_torneo');

    RAISE NOTICE 'Simulación creada con éxito. Torneo ID: %', v_torneo_id;
END $$;
