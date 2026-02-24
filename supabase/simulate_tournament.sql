-- ==========================================
-- ManilaPadelAPP - Simulación de Torneo (v16 - REPAIR & SIM)
-- Propósito: Reparar columnas, asegurar identidades y cargar data
-- ==========================================

-- 0. REPARAR ESQUEMA (Garantizar columnas necesarias)
DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='club_id') THEN ALTER TABLE partidos ADD COLUMN club_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='creador_id') THEN ALTER TABLE partidos ADD COLUMN creador_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='pareja1_id') THEN ALTER TABLE partidos ADD COLUMN pareja1_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='pareja2_id') THEN ALTER TABLE partidos ADD COLUMN pareja2_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='torneo_id') THEN ALTER TABLE partidos ADD COLUMN torneo_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='torneo_fase_id') THEN ALTER TABLE partidos ADD COLUMN torneo_fase_id UUID; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='resultado') THEN ALTER TABLE partidos ADD COLUMN resultado VARCHAR(100); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='lugar') THEN ALTER TABLE partidos ADD COLUMN lugar VARCHAR(255); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='nivel') THEN ALTER TABLE partidos ADD COLUMN nivel VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='sexo') THEN ALTER TABLE partidos ADD COLUMN sexo VARCHAR(50); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='partidos' AND column_name='tipo_partido_oficial') THEN ALTER TABLE partidos ADD COLUMN tipo_partido_oficial VARCHAR(50); END IF;
END $$;

-- 1. EJECUTAR SIMULACIÓN
DO $$
DECLARE
    v_sys_user UUID;
    v_sys_club UUID;
    v_torneo_id UUID;
    v_fase_id UUID;
    v_p_ids UUID[] := '{}';
    v_pareja_ids UUID[] := '{}';
    v_nombres TEXT[] := ARRAY['Nadal', 'Alcaraz', 'Sinner', 'Djokovic', 'Federer', 'Murray', 'Zverev', 'Medvedev', 'Ruud', 'Tsitsipas'];
    v_emails TEXT[] := ARRAY['nadal@pro.com', 'alcaraz@pro.com', 'sinner@pro.com', 'nole@pro.com', 'roger@pro.com', 'andy@pro.com', 'sascha@pro.com', 'danil@pro.com', 'casper@pro.com', 'stef@pro.com'];
    i INT;
    temp_id UUID;
BEGIN
    -- A. Creamos/Obtenemos el Administrador
    INSERT INTO users (nombre, email, rol, ciudad)
    VALUES ('Torneo Master', 'master@torneo.com', 'admin_club', 'Manizales')
    ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre
    RETURNING id INTO v_sys_user;

    -- B. Creamos/Obtenemos el Club (Sin ON CONFLICT para evitar el error de restricción única)
    SELECT id INTO v_sys_club FROM clubs WHERE admin_id = v_sys_user AND nombre = 'Arena Manila Sim' LIMIT 1;
    
    IF v_sys_club IS NULL THEN
        INSERT INTO clubs (admin_id, nombre, direccion, canchas_disponibles, verificado, ciudad)
        VALUES (v_sys_user, 'Arena Manila Sim', 'Av. Santander', 4, TRUE, 'Manizales')
        RETURNING id INTO v_sys_club;
    END IF;

    -- C. Crear los 10 Jugadores
    FOR i IN 1..10 LOOP
        INSERT INTO users (nombre, email, nivel, rol, ciudad)
        VALUES (v_nombres[i], v_emails[i], 'avanzado', 'jugador', 'Manizales')
        ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre
        RETURNING id INTO temp_id;
        v_p_ids := array_append(v_p_ids, temp_id);
    END LOOP;

    -- D. Crear las 5 Parejas
    FOR i IN 1..5 LOOP
        INSERT INTO parejas (jugador1_id, jugador2_id, nombre_pareja, activa)
        VALUES (v_p_ids[(i*2)-1], v_p_ids[i*2], v_nombres[(i*2)-1] || ' & ' || v_nombres[i*2], TRUE)
        ON CONFLICT (jugador1_id, jugador2_id) DO UPDATE SET activa = TRUE
        RETURNING id INTO temp_id;
        v_pareja_ids := array_append(v_pareja_ids, temp_id);
    END LOOP;

    -- E. Crear el Torneo
    INSERT INTO torneos (club_id, nombre, fecha_inicio, fecha_fin, formato)
    VALUES (v_sys_user, 'Grand Slam Manila 2026', NOW(), NOW() + INTERVAL '10 days', 'Eliminatoria Directa')
    RETURNING id INTO v_torneo_id;

    -- F. Crear Fase
    INSERT INTO torneo_fases (torneo_id, tipo_fase, nombre_fase, orden)
    VALUES (v_torneo_id, 'grupo', 'Cuartos de Final', 1)
    RETURNING id INTO v_fase_id;

    -- G. Insertar Partidos (Usando v_sys_user para garantizar integridad referencial)
    INSERT INTO partidos (creador_id, pareja1_id, pareja2_id, club_id, fecha, resultado, estado, torneo_id, torneo_fase_id, tipo_partido_oficial, lugar, nivel, sexo)
    VALUES (v_sys_user, v_pareja_ids[1], v_pareja_ids[2], v_sys_club, NOW(), '6-2, 6-4', 'completado_validado', v_torneo_id, v_fase_id, 'oficial_torneo', 'Cancha Master', 'avanzado', 'masculino');

    INSERT INTO partidos (creador_id, pareja1_id, pareja2_id, club_id, fecha, resultado, estado, torneo_id, torneo_fase_id, tipo_partido_oficial, lugar, nivel, sexo)
    VALUES (v_sys_user, v_pareja_ids[3], v_pareja_ids[4], v_sys_club, NOW(), '7-5, 6-3', 'completado_validado', v_torneo_id, v_fase_id, 'oficial_torneo', 'Cancha Pro', 'avanzado', 'masculino');

    RAISE NOTICE '--- SIMULACION COMPLETADA ---';
    RAISE NOTICE 'ID Torneo: %', v_torneo_id;
END $$;
