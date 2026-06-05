"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { getOrCreateInvitado } from "@/lib/invitados";
import { TBD_PREFIX, esParejaPlaceholder, type JugadorLite, type ParejaCatalogoEntry } from "@/lib/tbd";
import { revalidatePath } from "next/cache";

/**
 * Crea N parejas placeholder ("TBD · cat #1", "#2", ...) para una categoría,
 * arma los grupos de round-robin de 3, las inscribe en torneo_parejas, y
 * genera los partidos correspondientes con esos placeholders.
 *
 * Se llama desde `crearTorneoCentral` para Relámpago cuando el admin marca
 * "pre-cargar con parejas TBD" y dice cuántas parejas habrá por categoría.
 */
/** Config por categoría para la pre-creación de slots TBD.
 *  `parejas` = cuántos placeholders crear.
 *  `grupos` (opcional) = cuántos grupos armar. Si no se pasa, default = max(1, floor(parejas/3)). */
export type CrearGruposCatCfg = number | { parejas: number; grupos?: number };

export async function crearGruposRelampagoConTBD({
    torneoId,
    creadorAuthId,
    clubId,
    fechaSentinel,
    configPorCategoria,
}: {
    torneoId: string;
    creadorAuthId: string;
    clubId: string;
    fechaSentinel: string; // ISO — usado en partidos.fecha (NOT NULL)
    configPorCategoria: Record<string, CrearGruposCatCfg>;
}): Promise<{ success: boolean; error?: string; placeholdersCreados?: number; gruposCreados?: number }> {
    try {
        const admin = createPureAdminClient();

        let totalPlaceholders = 0;
        let totalGrupos = 0;

        for (const [categoria, cfg] of Object.entries(configPorCategoria)) {
            const parsedCfg = typeof cfg === "number"
                ? { parejas: cfg, grupos: undefined as number | undefined }
                : { parejas: cfg.parejas, grupos: cfg.grupos };
            const N = Math.max(0, Math.floor(Number(parsedCfg.parejas) || 0));
            if (N < 2) continue;

            // 1) Crear N parejas placeholder
            const placeholdersData = Array.from({ length: N }).map((_, i) => ({
                jugador1_id: null,
                jugador2_id: null,
                nombre_pareja: `${TBD_PREFIX} ${categoria} #${i + 1}`,
                puntos_ranking: 1000,
                activa: false,
            }));

            const { data: placeholders, error: pErr } = await admin
                .from("parejas")
                .insert(placeholdersData)
                .select("id");

            if (pErr || !placeholders) {
                console.error("[crearGruposRelampagoConTBD] error creando placeholders:", pErr);
                return { success: false, error: `Error creando placeholders: ${pErr?.message ?? "desconocido"}` };
            }
            totalPlaceholders += placeholders.length;

            // 2) Inscribirlas en torneo_parejas
            const inscripciones = placeholders.map((p: { id: string }) => ({
                torneo_id: torneoId,
                pareja_id: p.id,
                categoria,
                estado_pago: "pendiente",
            }));
            const { error: insErr } = await admin.from("torneo_parejas").insert(inscripciones);
            if (insErr) {
                console.error("[crearGruposRelampagoConTBD] error inscribiendo:", insErr);
                return { success: false, error: `Error inscribiendo placeholders: ${insErr.message}` };
            }

            // 3) Calcular cuántos grupos: override manual si viene, sino default de 3 por grupo.
            const numGrupos = parsedCfg.grupos != null && parsedCfg.grupos >= 1
                ? Math.min(parsedCfg.grupos, N) // no más grupos que parejas
                : Math.max(1, Math.floor(N / 3));
            totalGrupos += numGrupos;

            // 4) Distribuir placeholders secuencialmente entre grupos
            //    1→A, 2→B, 3→C, 4→A, ...
            const buckets: { id: string }[][] = Array.from({ length: numGrupos }, () => []);
            placeholders.forEach((p: { id: string }, idx: number) => {
                buckets[idx % numGrupos].push(p);
            });

            // 5) Crear los grupos en torneo_grupos
            const gruposData = buckets.map((_, i) => ({
                torneo_id: torneoId,
                nombre_grupo: `Grupo ${String.fromCharCode(65 + i)}`,
                categoria,
            }));
            const { data: grupos, error: gErr } = await admin
                .from("torneo_grupos")
                .insert(gruposData)
                .select("id, nombre_grupo");
            if (gErr || !grupos) {
                console.error("[crearGruposRelampagoConTBD] error creando grupos:", gErr);
                return { success: false, error: `Error creando grupos: ${gErr?.message ?? "desconocido"}` };
            }

            // 6) Generar partidos round-robin entre placeholders del mismo grupo
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const partidosACrear: any[] = [];
            for (let gi = 0; gi < buckets.length; gi++) {
                const ids = buckets[gi].map(p => p.id);
                const grupoId = grupos[gi].id;
                for (let i = 0; i < ids.length; i++) {
                    for (let j = i + 1; j < ids.length; j++) {
                        partidosACrear.push({
                            torneo_id: torneoId,
                            torneo_grupo_id: grupoId,
                            pareja1_id: ids[i],
                            pareja2_id: ids[j],
                            club_id: clubId,
                            creador_id: creadorAuthId,
                            nivel: categoria,
                            sexo: "Mixto",
                            estado: "programado",
                            tipo_partido_oficial: "torneo",
                            tipo_partido: "torneo",
                            fecha: fechaSentinel,
                            lugar: "Pendiente",
                            cupos_totales: 4,
                            cupos_disponibles: 0,
                        });
                    }
                }
            }

            if (partidosACrear.length > 0) {
                const { error: matchErr } = await admin.from("partidos").insert(partidosACrear);
                if (matchErr) {
                    console.error("[crearGruposRelampagoConTBD] error creando partidos:", matchErr);
                    return { success: false, error: `Error creando partidos: ${matchErr.message}` };
                }
            }
        }

        return { success: true, placeholdersCreados: totalPlaceholders, gruposCreados: totalGrupos };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[crearGruposRelampagoConTBD] EXCEPTION:", e);
        return { success: false, error: `Excepción: ${msg}` };
    }
}

/**
 * Reemplaza un placeholder TBD por una pareja real en TODOS los partidos,
 * en torneo_parejas y borra el placeholder de la tabla parejas.
 *
 * `seleccion` puede ser:
 *   - "pareja:<uuid>"                          → pareja existente del catálogo
 *   - "jugadores:<j1Ref>|<j2Ref>"              → construir pareja desde dos jugadores
 *       cada jugadorRef puede ser:
 *         - "uuid:<userId>"                    → jugador ya existente (registrado o invitado)
 *         - "manual:<Nombre Apellido>"         → crear/reusar invitado por nombre
 *   - Por retrocompatibilidad: un uuid suelto se trata como pareja_id existente.
 */
export async function asignarParejaASlot({
    torneoId,
    placeholderParejaId,
    seleccion,
    categoria,
}: {
    torneoId: string;
    placeholderParejaId: string;
    seleccion: string;
    categoria: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "No autenticado" };

        const admin = createPureAdminClient();

        // Helper para resolver un jugadorRef ("uuid:<id>" o "manual:<name>") a user_id
        const resolveJugadorRef = async (ref: string): Promise<string> => {
            if (ref.startsWith("uuid:")) {
                const id = ref.slice("uuid:".length).trim();
                if (!id) throw new Error("ID de jugador vacío");
                return id;
            }
            if (ref.startsWith("manual:")) {
                return await getOrCreateInvitado(admin, ref);
            }
            // Default: tratar como manual con el texto completo
            return await getOrCreateInvitado(admin, `manual:${ref}`);
        };

        // 1) Resolver la pareja real
        let parejaRealId: string | null = null;

        if (seleccion.startsWith("pareja:")) {
            // Modo catálogo: pareja directa
            parejaRealId = seleccion.slice("pareja:".length).trim();
        } else if (seleccion.startsWith("jugadores:")) {
            // Modo construir: dos jugadorRefs
            const payload = seleccion.slice("jugadores:".length);
            const [ref1, ref2] = payload.split("|").map(s => s.trim());
            if (!ref1 || !ref2) {
                return { success: false, error: "Debes definir ambos jugadores" };
            }
            const j1Id = await resolveJugadorRef(ref1);
            const j2Id = await resolveJugadorRef(ref2);
            if (j1Id === j2Id) return { success: false, error: "Los dos jugadores deben ser distintos" };

            // Buscar pareja existente (no placeholder) con esos dos jugadores
            const { data: existing } = await admin
                .from("parejas")
                .select("id, nombre_pareja")
                .or(`and(jugador1_id.eq.${j1Id},jugador2_id.eq.${j2Id}),and(jugador1_id.eq.${j2Id},jugador2_id.eq.${j1Id})`)
                .maybeSingle();

            if (existing?.id) {
                parejaRealId = existing.id;
                // Asegurar que esta pareja esté activa (puede haber quedado
                // desactivada al armar otra pareja con uno de sus jugadores).
                await admin.from("parejas").update({ activa: false })
                    .in("jugador1_id", [j1Id, j2Id]).neq("id", existing.id);
                await admin.from("parejas").update({ activa: false })
                    .in("jugador2_id", [j1Id, j2Id]).neq("id", existing.id);
                await admin.from("parejas").update({ activa: true }).eq("id", existing.id);
            } else {
                // Desactivar parejas activas previas de cualquiera de los dos
                // jugadores para no romper el partial unique index
                // (idx_jugador1_activo / idx_jugador2_activo) cuando insertamos
                // la nueva pareja con activa=true.
                await admin.from("parejas").update({ activa: false }).in("jugador1_id", [j1Id, j2Id]);
                await admin.from("parejas").update({ activa: false }).in("jugador2_id", [j1Id, j2Id]);

                // Crear pareja real con nombre corto
                const { data: jugadores } = await admin
                    .from("users").select("id, nombre, apellido").in("id", [j1Id, j2Id]);
                const nombreCorto = (u?: { nombre?: string | null; apellido?: string | null }) => {
                    if (!u) return "?";
                    const n = (u.nombre || "").trim();
                    const a = (u.apellido || "").trim();
                    if (n && a) return `${n.charAt(0).toUpperCase()}. ${a.split(/\s+/)[0]}`;
                    return n || "?";
                };
                const u1 = (jugadores || []).find((u: { id: string }) => u.id === j1Id);
                const u2 = (jugadores || []).find((u: { id: string }) => u.id === j2Id);
                const nombrePareja = `${nombreCorto(u1)} / ${nombreCorto(u2)}`;

                const { data: nueva, error: nErr } = await admin.from("parejas").insert({
                    jugador1_id: j1Id,
                    jugador2_id: j2Id,
                    nombre_pareja: nombrePareja,
                    activa: true,
                }).select("id").single();
                if (nErr || !nueva) {
                    return { success: false, error: "No se pudo crear la pareja: " + (nErr?.message || "") };
                }
                parejaRealId = nueva.id;
            }
        } else {
            parejaRealId = seleccion;
        }

        if (!parejaRealId) {
            return { success: false, error: "No se pudo resolver la pareja" };
        }
        if (parejaRealId === placeholderParejaId) {
            return { success: false, error: "La pareja ya es la misma del slot" };
        }

        // 2) Reemplazar referencias en partidos
        await admin
            .from("partidos")
            .update({ pareja1_id: parejaRealId })
            .eq("torneo_id", torneoId)
            .eq("pareja1_id", placeholderParejaId);

        await admin
            .from("partidos")
            .update({ pareja2_id: parejaRealId })
            .eq("torneo_id", torneoId)
            .eq("pareja2_id", placeholderParejaId);

        // 3) Reemplazar en torneo_parejas
        // Si la pareja real ya está inscrita en este torneo, evitar la colisión:
        // borramos primero la fila del placeholder.
        const { data: yaInscrita } = await admin
            .from("torneo_parejas")
            .select("id")
            .eq("torneo_id", torneoId)
            .eq("pareja_id", parejaRealId)
            .maybeSingle();

        if (yaInscrita?.id) {
            await admin
                .from("torneo_parejas")
                .delete()
                .eq("torneo_id", torneoId)
                .eq("pareja_id", placeholderParejaId);
        } else {
            await admin
                .from("torneo_parejas")
                .update({ pareja_id: parejaRealId, categoria })
                .eq("torneo_id", torneoId)
                .eq("pareja_id", placeholderParejaId);
        }

        // 4) Si era un placeholder TBD, borrarlo de parejas (ya no debería tener refs).
        // Si era una pareja real (modo "cambiar"), NO la borramos — puede vivir
        // en otros torneos / históricos.
        const { data: parejaInfo } = await admin
            .from("parejas")
            .select("nombre_pareja")
            .eq("id", placeholderParejaId)
            .maybeSingle();
        const eraPlaceholder = parejaInfo?.nombre_pareja?.startsWith(TBD_PREFIX) ?? false;
        if (eraPlaceholder) {
            await admin.from("parejas").delete().eq("id", placeholderParejaId);
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[asignarParejaASlot] EXCEPTION:", e);
        return { success: false, error: msg };
    }
}

/**
 * Lista parejas existentes (no placeholders) para mostrar en el dialog de
 * asignación. Excluye las que ya están inscritas en este torneo y los
 * placeholders TBD. Trae info de jugadores (con email) para poder mostrar
 * el marcador (I) en invitados.
 */
export async function listarParejasCatalogo(torneoId: string): Promise<ParejaCatalogoEntry[]> {
    const admin = createPureAdminClient();

    // Parejas ya inscritas en el torneo (para excluirlas del catálogo)
    const { data: inscritas } = await admin
        .from("torneo_parejas")
        .select("pareja_id")
        .eq("torneo_id", torneoId);
    const inscritasSet = new Set((inscritas || []).map((r: { pareja_id: string }) => r.pareja_id));

    const { data: all } = await admin
        .from("parejas")
        .select("id, nombre_pareja, jugador1_id, jugador2_id, activa")
        .not("jugador1_id", "is", null)
        .not("jugador2_id", "is", null)
        .order("nombre_pareja", { ascending: true });

    const parejasFiltradas = (all || []).filter((p: { id: string; nombre_pareja: string | null }) =>
        !inscritasSet.has(p.id) && !esParejaPlaceholder(p.nombre_pareja)
    );

    // Fetch jugadores con categoría para mostrar (I) y para fallback de categoría sugerida.
    // Intentamos seleccionar `categoria`; si la columna no existe, caemos al subset básico.
    const jugadorIds = new Set<string>();
    parejasFiltradas.forEach((p: { jugador1_id: string | null; jugador2_id: string | null }) => {
        if (p.jugador1_id) jugadorIds.add(p.jugador1_id);
        if (p.jugador2_id) jugadorIds.add(p.jugador2_id);
    });
    const jugadoresMap = new Map<string, JugadorLite>();
    if (jugadorIds.size > 0) {
        const idArr = Array.from(jugadorIds);
        let jugadores: JugadorLite[] | null = null;
        const conCat = await admin
            .from("users")
            .select("id, nombre, apellido, email, categoria")
            .in("id", idArr);
        if (!conCat.error) {
            jugadores = conCat.data as JugadorLite[];
        } else {
            const sinCat = await admin
                .from("users")
                .select("id, nombre, apellido, email")
                .in("id", idArr);
            jugadores = (sinCat.data || []) as JugadorLite[];
        }
        (jugadores || []).forEach((j: JugadorLite) => jugadoresMap.set(j.id, j));
    }

    // Calcular categoria_sugerida por pareja a partir del torneo MÁS RECIENTE
    // en el que se inscribió (cualquier torneo). Si no tiene ninguno, caemos a
    // la categoría del jugador1 / jugador2 de su perfil.
    const parejaIdsArr = parejasFiltradas.map((p: { id: string }) => p.id);
    const ultimaCatPorPareja = new Map<string, string>();
    if (parejaIdsArr.length > 0) {
        const { data: histo } = await admin
            .from("torneo_parejas")
            .select("pareja_id, categoria, torneos(fecha_inicio)")
            .in("pareja_id", parejaIdsArr);
        // Ordenar por fecha_inicio DESC en JS y quedarse con la primera entrada por pareja
        const rows = (histo || []) as Array<{
            pareja_id: string;
            categoria: string | null;
            torneos: { fecha_inicio: string | null } | { fecha_inicio: string | null }[] | null;
        }>;
        const enriquecidas = rows.map(r => {
            const t = Array.isArray(r.torneos) ? r.torneos[0] : r.torneos;
            return { pareja_id: r.pareja_id, categoria: r.categoria, fecha: t?.fecha_inicio ?? null };
        });
        enriquecidas.sort((a, b) => {
            const aT = a.fecha ? new Date(a.fecha).getTime() : 0;
            const bT = b.fecha ? new Date(b.fecha).getTime() : 0;
            return bT - aT;
        });
        for (const r of enriquecidas) {
            if (r.categoria && !ultimaCatPorPareja.has(r.pareja_id)) {
                ultimaCatPorPareja.set(r.pareja_id, r.categoria);
            }
        }
    }

    return parejasFiltradas.map((p: { id: string; nombre_pareja: string | null; jugador1_id: string | null; jugador2_id: string | null }) => {
        const j1 = p.jugador1_id ? (jugadoresMap.get(p.jugador1_id) || null) : null;
        const j2 = p.jugador2_id ? (jugadoresMap.get(p.jugador2_id) || null) : null;
        const categoria_sugerida =
            ultimaCatPorPareja.get(p.id)
            ?? j1?.categoria
            ?? j2?.categoria
            ?? null;
        return {
            id: p.id,
            nombre_pareja: p.nombre_pareja,
            jugador1: j1,
            jugador2: j2,
            categoria_sugerida,
        };
    });
}

/**
 * Busca jugadores por nombre y/o apellido. Soporta consultas con múltiples
 * tokens — cada palabra debe coincidir en `nombre` OR `apellido` (case-insensitive).
 * Ejemplo: "juan cano" → encuentra al jugador {nombre:"Juan David", apellido:"Cano"}.
 *
 * Devuelve hasta 20 resultados, mezclando registrados e invitados existentes.
 */
export async function buscarJugadores(query: string): Promise<JugadorLite[]> {
    const q = (query || "").trim();
    if (q.length < 1) return [];

    const admin = createPureAdminClient();

    // Tokenizar la búsqueda. Cada token debe matchear nombre o apellido.
    // Limitamos a 4 tokens para evitar abusos.
    const tokens = q
        .split(/\s+/)
        .map(t => t.replace(/[%_]/g, ""))
        .filter(Boolean)
        .slice(0, 4);

    if (tokens.length === 0) return [];

    // PostgREST/Supabase `.or` no compone fácilmente con AND a nivel de query
    // builder. Pero como tenemos pocos tokens, traemos por el PRIMER token
    // (que ya recorta bastante) y filtramos en memoria por los siguientes.
    const primary = tokens[0];
    const pattern = `%${primary}%`;

    const { data, error } = await admin
        .from("users")
        .select("id, nombre, apellido, email")
        .eq("rol", "jugador")
        .or(`nombre.ilike.${pattern},apellido.ilike.${pattern}`)
        .order("nombre", { ascending: true })
        .limit(200);

    if (error) {
        console.error("[buscarJugadores] error:", error);
        return [];
    }

    const restantes = tokens.slice(1).map(t => t.toLowerCase());
    const filtrado = (data || []).filter((j: JugadorLite) => {
        const n = (j.nombre || "").toLowerCase();
        const a = (j.apellido || "").toLowerCase();
        return restantes.every(t => n.includes(t) || a.includes(t));
    });

    return filtrado.slice(0, 20) as JugadorLite[];
}

/**
 * Vuelve un slot a TBD (deshace una asignación). Crea un placeholder nuevo
 * con el siguiente número disponible para esa categoría, y reemplaza
 * referencias de la pareja real por el nuevo placeholder. NO borra la
 * pareja real — solo la desvincula de los partidos del torneo.
 */
export async function quitarParejaDelSlot({
    torneoId,
    parejaRealId,
    categoria,
}: {
    torneoId: string;
    parejaRealId: string;
    categoria: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "No autenticado" };

        const admin = createPureAdminClient();

        // 1) Buscar el siguiente número de placeholder libre para esa categoría
        const { data: existentes } = await admin
            .from("parejas")
            .select("nombre_pareja")
            .like("nombre_pareja", `${TBD_PREFIX} ${categoria} #%`);

        let nextNum = 1;
        if (existentes && existentes.length > 0) {
            const nums = existentes
                .map((p: { nombre_pareja: string | null }) => {
                    const m = (p.nombre_pareja || "").match(/#(\d+)$/);
                    return m ? parseInt(m[1], 10) : 0;
                })
                .filter((n: number) => !isNaN(n));
            nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
        }

        // 2) Crear nuevo placeholder
        const { data: nuevoPlaceholder, error: pErr } = await admin
            .from("parejas")
            .insert({
                jugador1_id: null,
                jugador2_id: null,
                nombre_pareja: `${TBD_PREFIX} ${categoria} #${nextNum}`,
                puntos_ranking: 1000,
                activa: false,
            })
            .select("id")
            .single();
        if (pErr || !nuevoPlaceholder) {
            return { success: false, error: "No se pudo crear placeholder: " + (pErr?.message || "") };
        }

        // 3) Reemplazar en partidos y torneo_parejas
        await admin.from("partidos").update({ pareja1_id: nuevoPlaceholder.id })
            .eq("torneo_id", torneoId).eq("pareja1_id", parejaRealId);
        await admin.from("partidos").update({ pareja2_id: nuevoPlaceholder.id })
            .eq("torneo_id", torneoId).eq("pareja2_id", parejaRealId);

        await admin.from("torneo_parejas")
            .update({ pareja_id: nuevoPlaceholder.id })
            .eq("torneo_id", torneoId).eq("pareja_id", parejaRealId);

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[quitarParejaDelSlot] EXCEPTION:", e);
        return { success: false, error: msg };
    }
}
