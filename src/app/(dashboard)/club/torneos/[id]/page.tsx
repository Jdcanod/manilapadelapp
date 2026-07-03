export const dynamic = 'force-dynamic';
import { createClient, createAdminClient, createPureAdminClient } from "@/utils/supabase/server";
import { format, addHours } from "date-fns";
import { redirect } from "next/navigation";
import { ChevronLeft, CalendarDays, Users, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminParticipantActions } from "@/components/AdminParticipantActions";

import { TournamentGroupsManager } from "@/components/TournamentGroupsManager";
import { TournamentBracketManager } from "@/components/TournamentBracketManager";
import { AddTournamentPlayerModal } from "@/components/AddTournamentPlayerModal";
import { TournamentChronogram } from "@/components/TournamentChronogram";
import { TournamentExportButton } from "@/components/TournamentExportButton";
import { TournamentResultsManager } from "@/components/TournamentResultsManager";
import { CopaDavisManager } from "@/components/CopaDavisManager";
import { CrearVueltaCopaDialog } from "@/components/CrearVueltaCopaDialog";
import { EditarCanchasControl } from "@/components/EditarCanchasControl";
import { PersistentTabs } from "@/components/PersistentTabs";
import { formatPairName } from "@/lib/display-names";



export default async function TorneoDetailsPage({ params, searchParams }: { params: { id: string }; searchParams?: { creation_warning?: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const creationWarning = searchParams?.creation_warning ? decodeURIComponent(searchParams.creation_warning) : null;

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('rol, id')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    const { data: torneo, error: torneoError } = await supabase
        .from('torneos')
        .select(`
            *,
            club:users!club_id(id, nombre, foto),
            club_rival:users!club_rival_id(id, nombre, foto),
            torneo_parejas(*, pareja:parejas(*)),
            torneo_fases(*)
        `)
        .eq('id', params.id)
        // Permitir acceso al admin del club host O al admin del club rival (Copa Davis)
        .or(`club_id.eq.${userData.id},club_rival_id.eq.${userData.id}`)
        .single();

    if (torneoError || !torneo) {
        console.error("DEBUG - Torneo Error:", torneoError);
        return <div className="p-8 text-center text-red-500">Error: Torneo no encontrado o sin permisos.</div>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clubInfo = userData.id === torneo.club_rival_id ? (torneo as any).club_rival : (torneo as any).club;

    // Cargar inscripciones Master por separado
    const { data: inscripcionesMaster } = await supabase
        .from('inscripciones_torneo')
        .select(`
            *,
            jugador1:users!jugador1_id(id, nombre, apellido, email, puntos_ranking),
            jugador2:users!jugador2_id(id, nombre, apellido, email, puntos_ranking)
        `)
        .eq('torneo_id', params.id);

    // Cargar grupos existentes
    const { data: gruposExistentes } = await supabase
        .from('torneo_grupos')
        .select('*')
        .eq('torneo_id', params.id);

    const adminSupabase = createAdminClient();
    const pureAdmin = createPureAdminClient();

    // 1. Obtener TODOS los partidos del torneo anticipadamente
    const { data: rawPartidos } = await pureAdmin
        .from('partidos')
        .select('*')
        .eq('torneo_id', params.id)
        .order('fecha', { ascending: true })
        .limit(5000);

    // 2. Obtener todas las parejas involucradas en este torneo para mapear nombres e IDs
    const pairIdsInMatches = new Set<string>();
    (rawPartidos || []).forEach((p: { pareja1_id?: string | null; pareja2_id?: string | null }) => {
        if (p.pareja1_id) pairIdsInMatches.add(p.pareja1_id);
        if (p.pareja2_id) pairIdsInMatches.add(p.pareja2_id);
    });

    // También incluir las parejas de torneo_parejas
    if (torneo.torneo_parejas) {
        torneo.torneo_parejas.forEach((tp: { pareja_id: string }) => {
            if (tp.pareja_id) pairIdsInMatches.add(tp.pareja_id);
        });
    }

    const parejaDataMap = new Map<string, { id: string; nombre_pareja: string; jugador1_id: string; jugador2_id: string }>();
    if (pairIdsInMatches.size > 0) {
        const { data: namesData } = await adminSupabase
            .from('parejas')
            .select('id, nombre_pareja, jugador1_id, jugador2_id')
            .in('id', Array.from(pairIdsInMatches));

        namesData?.forEach((n: { id: string; nombre_pareja: string; jugador1_id: string; jugador2_id: string }) => parejaDataMap.set(n.id, n));
    }

    // ─── Cargar jugadores reales (con email) para detectar invitados y armar
    //     nombres formateados consistentes ─────────────────────────────────────
    const allJugadorIds = new Set<string>();
    parejaDataMap.forEach(p => {
        if (p.jugador1_id) allJugadorIds.add(p.jugador1_id);
        if (p.jugador2_id) allJugadorIds.add(p.jugador2_id);
    });
    const jugadorMap = new Map<string, { nombre: string | null; apellido: string | null; email: string | null }>();
    if (allJugadorIds.size > 0) {
        const { data: jugadoresData } = await adminSupabase
            .from('users')
            .select('id, nombre, apellido, email')
            .in('id', Array.from(allJugadorIds));
        (jugadoresData || []).forEach((u: { id: string; nombre: string | null; apellido: string | null; email: string | null }) => {
            jugadorMap.set(u.id, { nombre: u.nombre, apellido: u.apellido, email: u.email });
        });
    }
    // pareja_id → [jugador1, jugador2] con nombre+apellido+email para detectar (I)
    const parejaPlayersMap: Record<string, [{ nombre: string | null; apellido: string | null; email: string | null } | null, { nombre: string | null; apellido: string | null; email: string | null } | null]> = {};
    parejaDataMap.forEach((p, parejaId) => {
        parejaPlayersMap[parejaId] = [
            p.jugador1_id ? jugadorMap.get(p.jugador1_id) || null : null,
            p.jugador2_id ? jugadorMap.get(p.jugador2_id) || null : null,
        ];
    });

    interface Participant {
        id: string | number;
        pareja_id: string;
        nombre: string;
        categoria: string;
        estado_pago: string;
        tipo: 'regular' | 'master';
        jugador1_id?: string;
        jugador2_id?: string;
        grupo_id?: string | null;
        representando_club_id?: string | null;
    }

    const allParticipants: Participant[] = [];
    
    // Regular pairs
    if (torneo.torneo_parejas) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        torneo.torneo_parejas.forEach((tp: any) => {
            // Resolver nombre formateado usando jugadorMap si tenemos los IDs
            const j1 = tp.pareja?.jugador1_id ? jugadorMap.get(tp.pareja.jugador1_id) : null;
            const j2 = tp.pareja?.jugador2_id ? jugadorMap.get(tp.pareja.jugador2_id) : null;
            const formatted = (j1 || j2)
                ? formatPairName(j1, j2)
                : (tp.pareja?.nombre_pareja || "Pareja s/n");
            allParticipants.push({
                id: tp.id,
                pareja_id: tp.pareja?.id || tp.pareja_id,
                nombre: formatted,
                categoria: tp.categoria,
                estado_pago: tp.estado_pago,
                tipo: 'regular',
                jugador1_id: tp.pareja?.jugador1_id,
                jugador2_id: tp.pareja?.jugador2_id,
                grupo_id: tp.torneo_grupo_id ? String(tp.torneo_grupo_id) : null,
                representando_club_id: tp.representando_club_id
            });
        });
    }

    // Master players (converted to pairs display)
    if (inscripcionesMaster) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inscripcionesMaster.forEach((ins: any) => {
            // Buscamos la pareja_id real en los partidos o en el mapa si ya existe
            let foundParejaId = ins.id; // fallback
            for (const [pId, pData] of Array.from(parejaDataMap.entries())) {
                if ((pData.jugador1_id === ins.jugador1_id && pData.jugador2_id === ins.jugador2_id) ||
                    (pData.jugador1_id === ins.jugador2_id && pData.jugador2_id === ins.jugador1_id)) {
                    foundParejaId = pId;
                    break;
                }
            }

            allParticipants.push({
                id: ins.id,
                pareja_id: foundParejaId,
                nombre: formatPairName(
                    ins.jugador1 ? { nombre: ins.jugador1.nombre, apellido: ins.jugador1.apellido, email: ins.jugador1.email } : null,
                    ins.jugador2 ? { nombre: ins.jugador2.nombre, apellido: ins.jugador2.apellido, email: ins.jugador2.email } : null
                ),
                categoria: ins.nivel,
                estado_pago: ins.estado || 'pendiente',
                tipo: 'master',
                jugador1_id: ins.jugador1_id,
                jugador2_id: ins.jugador2_id,
                grupo_id: ins.torneo_grupo_id ? String(ins.torneo_grupo_id) : null,
                representando_club_id: ins.representando_club_id
            });
        });
    }

    // SINCRONIZACIÓN CRÍTICA: Algunos participantes no tienen el grupo_id en su registro, 
    // pero sí están en los partidos de un grupo. Vamos a mapearlos como hace la web.
    if (rawPartidos) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawPartidos.forEach((m: any) => {
            if (m.torneo_grupo_id) {
                const gId = String(m.torneo_grupo_id);
                // Buscar participantes que coincidan con las parejas de este partido
                allParticipants.forEach(p => {
                    if (p.pareja_id === m.pareja1_id || p.pareja_id === m.pareja2_id) {
                        if (!p.grupo_id) p.grupo_id = gId;
                    }
                });
            }
        });
    }

    // Extraer categorías únicas para el selector de grupos y limpiar nulos
    const categoriasConInscritos = Array.from(new Set(allParticipants.map(p => p.categoria).filter(Boolean)));
    const categoriasHabilitadas = torneo.reglas_puntuacion?.categorias_habilitadas || ['2da', '3ra', '4ta', '5ta', '6ta', '7ma', 'Mixto A', 'Mixto B', 'Mixto C'];
    const categoriasAMostrar = categoriasConInscritos.length > 0 ? categoriasConInscritos : categoriasHabilitadas;

    // Conteo de partidos por confirmar (para badge en el tab)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendientesCount = (rawPartidos || []).filter((p: any) =>
        p.pareja1_id && p.pareja2_id && p.resultado && p.estado_resultado !== 'confirmado'
    ).length;

    // Cargar nombres de quien reportó cada resultado pendiente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reporterIds = Array.from(new Set((rawPartidos || []).map((p: any) => p.resultado_registrado_por).filter(Boolean))) as string[];
    const reporterMap: Record<string, string> = {};
    if (reporterIds.length > 0) {
        const { data: reporters } = await adminSupabase
            .from('users')
            .select('id, nombre')
            .in('id', reporterIds);
        (reporters || []).forEach((r: { id: string; nombre: string | null }) => {
            reporterMap[r.id] = r.nombre || 'Jugador';
        });
    }

    const hasStarted = (rawPartidos || []).length > 0;

    // Copa Davis: cargar info del club rival y aplicar privacidad de "intriga"
    // El club rival no ve las parejas del otro club hasta 30 min antes de cada partido.
    let rivalClubData: { id: string; nombre: string } | null = null;
    let currentClubIdCopa: string = String(userData.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inscripcionesCopa: any[] = [];
    let inscripcionesJugadores: { id: string; nombre: string | null; apellido: string | null; email: string | null }[] = [];
    const REVEAL_MINUTES = 30; // ventana de revelación antes del partido
    if (torneo.formato === 'copa_davis' && torneo.club_rival_id) {
        const { data: rd } = await adminSupabase
            .from('users')
            .select('id, nombre')
            .eq('id', torneo.club_rival_id)
            .single();
        if (rd) rivalClubData = { id: rd.id, nombre: rd.nombre || 'Rival' };

        // Inscripciones del torneo (con info de la pareja)
        const { data: insData } = await adminSupabase
            .from('torneo_parejas')
            .select('id, pareja_id, categoria, representando_club_id, pareja:parejas(id, nombre_pareja, jugador1_id, jugador2_id)')
            .eq('torneo_id', params.id);
        inscripcionesCopa = insData || [];

        // Jugadores referenciados en las inscripciones
        const userIds = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inscripcionesCopa.forEach((i: any) => {
            const p = i.pareja;
            if (p?.jugador1_id) userIds.add(p.jugador1_id);
            if (p?.jugador2_id) userIds.add(p.jugador2_id);
        });
        if (userIds.size > 0) {
            const { data: jugData } = await adminSupabase
                .from('users')
                .select('id, nombre, apellido, email')
                .in('id', Array.from(userIds));
            inscripcionesJugadores = (jugData || []) as typeof inscripcionesJugadores;
        }
        // PRIVACIDAD: el admin actual solo ve las inscripciones de SU club.
        // Las del rival se ocultan completamente (no se envían al cliente).
        currentClubIdCopa = String(userData.id);
    }

    // Copa Davis serie ida/vuelta: cargar el torneo enlazado (si existe) para
    // mostrar el enlace de trazabilidad, y decidir si se puede crear la vuelta.
    let serieEnlace: { id: string; nombre: string; esVuelta: boolean } | null = null;
    let puedeCrearVuelta = false;
    // Puntos del torneo enlazado, mapeados a los clubes de ESTE torneo (por id,
    // porque local/visitante pueden estar intercambiados entre ida y vuelta).
    let seriePuntosEnlace: { local: number; rival: number } | null = null;
    if (torneo.formato === 'copa_davis') {
        const copaSerie = torneo.reglas_puntuacion?.copa_serie as
            | { rol: 'ida' | 'vuelta'; torneo_ida_id?: string; torneo_vuelta_id?: string }
            | undefined;
        const enlaceId = copaSerie?.rol === 'vuelta' ? copaSerie.torneo_ida_id : copaSerie?.torneo_vuelta_id;
        if (enlaceId) {
            const { data: tEnlace } = await adminSupabase
                .from('torneos').select('id, nombre, club_id, club_rival_id').eq('id', enlaceId).maybeSingle();
            if (tEnlace) {
                serieEnlace = { id: tEnlace.id, nombre: tEnlace.nombre || 'Torneo enlazado', esVuelta: copaSerie?.rol === 'ida' };

                // Marcador del torneo enlazado: pareja1 = club_id (host de ESE torneo),
                // pareja2 = club_rival_id. Se acumula por id de club real.
                const { data: pEnlace } = await adminSupabase
                    .from('partidos')
                    .select('resultado, puntos_partido')
                    .eq('torneo_id', tEnlace.id);
                const puntosPorClub: Record<string, number> = {
                    [String(tEnlace.club_id)]: 0,
                    [String(tEnlace.club_rival_id)]: 0,
                };
                (pEnlace || []).forEach((p: { resultado: string | null; puntos_partido: number | null }) => {
                    if (!p.resultado) return;
                    const normalised = p.resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
                    const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
                    let s1 = 0, s2 = 0;
                    raw.split(',').forEach(s => {
                        const [a, b] = s.trim().split('-').map(Number);
                        if (isNaN(a) || isNaN(b)) return;
                        if (a > b) s1++; else if (b > a) s2++;
                    });
                    const valor = p.puntos_partido || 0;
                    if (s1 > s2) puntosPorClub[String(tEnlace.club_id)] += valor;
                    else if (s2 > s1) puntosPorClub[String(tEnlace.club_rival_id)] += valor;
                });
                seriePuntosEnlace = {
                    local: puntosPorClub[String(torneo.club_id)] || 0,
                    rival: puntosPorClub[String(torneo.club_rival_id)] || 0,
                };
            }
        }
        // Cualquier admin de los dos clubes puede crear la vuelta, solo si:
        // este torneo NO es ya una vuelta, y no existe una vuelta viva enlazada.
        puedeCrearVuelta = copaSerie?.rol !== 'vuelta' && !serieEnlace && !!torneo.club_rival_id;
    }

    // Mapa pareja_id → club que representa (necesario para privacidad en partidos)
    const parejaToClub: Map<string, string> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inscripcionesCopa.forEach((i: any) => {
        if (i.pareja_id && i.representando_club_id) {
            parejaToClub.set(i.pareja_id, String(i.representando_club_id));
        }
    });

    // Filtrar inscripciones para enviar al cliente: solo las del club del admin
    if (torneo.formato === 'copa_davis') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inscripcionesCopa = inscripcionesCopa.filter((i: any) =>
            String(i.representando_club_id) === currentClubIdCopa
        );
    }


    interface MatchReal {
        id: string;
        pareja1_id?: string | null;
        pareja2_id?: string | null;
        torneo_grupo_id: string | null;
        torneo_fase_id?: string | null;
        estado: string;
        estado_resultado?: string | null;
        resultado: string | null;
        lugar: string | null;
        nivel?: string | null;
        fecha: string | null;
        club_id?: string | null;
        pareja1: { id?: string; nombre_pareja: string | null } | null;
        pareja2: { id?: string; nombre_pareja: string | null } | null;
        jugador1_id?: string;
        jugador2_id?: string;
        jugador3_id?: string;
        jugador4_id?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    }

    const esCopaDavis = torneo.formato === 'copa_davis';
    const nowMs = Date.now();
    const HIDDEN_TEXT = 'Por revelar';
    // Decide si una pareja debe ocultarse al admin actual en Copa Davis.
    // Pareja del mismo club: siempre visible. Pareja del rival: solo se revela
    // si el partido ya tiene resultado o faltan 30 min o menos para su fecha.
    const debeOcultar = (parejaId: string | null | undefined, partidoFecha: string | null, tieneResultado: boolean): boolean => {
        if (!esCopaDavis) return false;
        if (!parejaId) return false;
        const clubDeLaPareja = parejaToClub.get(parejaId);
        if (!clubDeLaPareja) return false;
        if (clubDeLaPareja === currentClubIdCopa) return false;
        // Es del rival — solo se revela si ya jugó o si faltan ≤30 min
        if (tieneResultado) return false;
        if (!partidoFecha) return true;
        const diffMin = (new Date(partidoFecha).getTime() - nowMs) / 60000;
        return diffMin > REVEAL_MINUTES;
    };

    const partidosReales: MatchReal[] = (rawPartidos || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => {
            // Copa Davis: incluir todos los partidos del torneo (placeholders + ya asignados)
            if (esCopaDavis) return true;
            // Otros formatos: solo de grupos o de fases finales nombradas
            return p.torneo_grupo_id || p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos|tercer puesto/);
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => {
        const p1 = parejaDataMap.get(p.pareja1_id);
        const p2 = parejaDataMap.get(p.pareja2_id);
        
        // Formatear nombres correctamente usando los jugadores individuales
        let nombreP1 = p1?.nombre_pareja;
        if (!nombreP1 && p.pareja1_id) {
            const players = parejaPlayersMap[p.pareja1_id];
            if (players) nombreP1 = formatPairName(players[0], players[1]);
        }
        
        let nombreP2 = p2?.nombre_pareja;
        if (!nombreP2 && p.pareja2_id) {
            const players = parejaPlayersMap[p.pareja2_id];
            if (players) nombreP2 = formatPairName(players[0], players[1]);
        }
        
        const tieneResultado = !!p.resultado;
        const oculta1 = debeOcultar(p.pareja1_id, p.fecha, tieneResultado);
        const oculta2 = debeOcultar(p.pareja2_id, p.fecha, tieneResultado);
        return {
            ...p,
            // Si la pareja es del rival y aún no se revela, mandamos un placeholder.
            // También quitamos el ID para que el cliente no la pueda re-derivar.
            pareja1_id: oculta1 ? null : p.pareja1_id,
            pareja2_id: oculta2 ? null : p.pareja2_id,
            pareja1: { id: oculta1 ? null : p.pareja1_id, nombre_pareja: oculta1 ? HIDDEN_TEXT : (nombreP1 || "TBD") },
            pareja2: { id: oculta2 ? null : p.pareja2_id, nombre_pareja: oculta2 ? HIDDEN_TEXT : (nombreP2 || "TBD") },
            jugador1_id: oculta1 ? undefined : p1?.jugador1_id,
            jugador2_id: oculta1 ? undefined : p1?.jugador2_id,
            jugador3_id: oculta2 ? undefined : p2?.jugador1_id,
            jugador4_id: oculta2 ? undefined : p2?.jugador2_id
        } as MatchReal;
    });

    // Identificar Campeones y estado de finalización
    const campeonesPorCategoria = categoriasAMostrar.map((cat: string) => {
        const matchesCat = partidosReales.filter(p => p.nivel?.toLowerCase() === cat.toLowerCase());
        const finalCat = matchesCat.find(p => 
            p.lugar?.toLowerCase().includes('final') && 
            !p.lugar?.toLowerCase().includes('semi') &&
            !p.lugar?.toLowerCase().includes('cuartos') &&
            !p.lugar?.toLowerCase().includes('octavos')
        );
        
        let ganador = null;
        let segundo = null;
        if (finalCat?.estado === 'jugado' && finalCat?.resultado && finalCat?.estado_resultado === 'confirmado') {
            const sets = String(finalCat.resultado).split(',').map((s: string) => s.trim().split('-').map(Number));
            let p1 = 0, p2 = 0;
            sets.forEach((s: number[]) => { if (s[0] > s[1]) p1++; else if (s[1] > s[0]) p2++; });
            if (p1 > p2) {
                ganador = finalCat.pareja1?.nombre_pareja;
                segundo = finalCat.pareja2?.nombre_pareja;
            } else {
                ganador = finalCat.pareja2?.nombre_pareja;
                segundo = finalCat.pareja1?.nombre_pareja;
            }
        }
        return { categoria: cat, ganador, segundo, tieneFinal: !!finalCat };
    });

    // Un torneo está finalizado solo si TODAS las categorías que tienen partidos han terminado sus finales
    const matchesEnEliminatorias = partidosReales.filter(p => !p.torneo_grupo_id);
    const categoriasConEliminatorias = Array.from(new Set(matchesEnEliminatorias.map(p => p.nivel).filter((n): n is string => !!n)));
    
    const todosFinalizados = categoriasConEliminatorias.length > 0 && categoriasConEliminatorias.every((cat: string) => {
        const cData = campeonesPorCategoria.find((c: { categoria: string; ganador: string | null | undefined }) => c.categoria === cat);
        return cData?.ganador; // Si tiene ganador, es que la final se jugó y confirmó
    });

    const campeonParaHeader = (categoriasAMostrar.length === 1) ? campeonesPorCategoria[0].ganador : null;
    const subcampeonParaHeader = (categoriasAMostrar.length === 1) ? campeonesPorCategoria[0].segundo : null;

    const isPast = new Date(torneo.fecha_fin) < new Date();
    const isUpcoming = new Date(torneo.fecha_inicio) > new Date();

    let statusColor = "bg-olive/20 text-olive border-olive/30";
    let statusText = "Torneo En Curso";

    if (todosFinalizados) {
        statusColor = "bg-paper-dark text-olive border-olive/30";
        statusText = "Finalizado";
    } else if (isPast) {
        statusColor = "bg-ochre/20 text-ochre border-ochre/30";
        statusText = "Finalizando (Resultados Pendientes)";
    } else if (isUpcoming) {
        statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
        statusText = "Próximo";
    }

    return (
        <div className="space-y-6">
            {creationWarning && (
                <div className="bg-ochre/10 border border-ochre/30 rounded-xl p-4 text-ochre-soft text-sm">
                    <p className="font-bold mb-1">⚠️ Aviso al crear el torneo</p>
                    <p className="text-xs text-amber-200/80">{creationWarning}</p>
                </div>
            )}
            <div className="flex items-start gap-4 mb-2">
                <Link
                    href="/club/torneos"
                    className="p-2 bg-paper-soft border border-olive/20 rounded-xl hover:bg-paper-dark transition-colors text-ink mt-1 shrink-0"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-1">
                            <h1 className="text-3xl font-bold tracking-tight text-ink leading-tight">
                                {torneo.nombre}
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={statusColor}>
                                    {statusText}
                                </Badge>
                                {todosFinalizados && (
                                    <Badge className="bg-ochre text-black font-black uppercase tracking-widest text-[10px] animate-pulse">
                                        ¡Torneo Finalizado!
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center text-sm text-olive font-medium mt-3 gap-4">
                            <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5 text-olive/70" />{new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')} - {new Date(torneo.fecha_fin).toLocaleDateString('es-CO')}</span>
                            <span className="flex items-center"><Swords className="w-4 h-4 mr-1.5 text-olive/70" />Modalidad: {torneo.formato}</span>
                        </div>
                    </div>

                    {/* Botón de Exportar con datos enriquecidos */}
                    <div className="flex items-center gap-2">
                        <TournamentExportButton 
                            torneo={torneo}
                            clubInfo={clubInfo}
                            currentClubId={userData.id}
                            partidos={(rawPartidos || [])
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .filter((p: any) => {
                                    if (!p.fecha) return false;
                                    // Excluir placeholders Copa Davis estilo "Pendiente · 4ta #1"
                                    const lugar = (p.lugar || '').toLowerCase();
                                    if (lugar.includes('pendiente ·')) return false;
                                    // Excluir partidos cuya fecha es exactamente la fecha_inicio del
                                    // torneo (sentinel para placeholders no programados).
                                    if (torneo.fecha_inicio && p.fecha === torneo.fecha_inicio) return false;
                                    return true;
                                })
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .map((p: any) => {
                                    const adjustedDate = addHours(new Date(p.fecha), -5);
                                    return {
                                        ...p,
                                        fecha_ajustada: adjustedDate.toISOString(),
                                        hora: format(adjustedDate, "HH:mm"),
                                        pareja1: parejaDataMap.get(p.pareja1_id || ""),
                                        pareja2: parejaDataMap.get(p.pareja2_id || "")
                                    };
                                })}
                            participantes={allParticipants}
                            grupos={gruposExistentes || []}
                        />
                    </div>

                    {campeonParaHeader && (
                        <div className="bg-paper-soft border border-ochre/30 p-4 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-right duration-500">
                            <div className="w-12 h-12 bg-ochre/10 rounded-full flex items-center justify-center border border-ochre/20">
                                <Trophy className="w-6 h-6 text-ochre-dark" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-ochre-dark uppercase tracking-widest leading-none mb-1">Campeón</p>
                                <p className="text-lg font-black text-ink uppercase italic tracking-tighter leading-none mb-1">{campeonParaHeader}</p>
                                {subcampeonParaHeader && (
                                    <p className="text-[10px] text-olive/70 font-bold uppercase tracking-tighter">Subcampeón: {subcampeonParaHeader}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* COPA DAVIS: vista propia que reemplaza los tabs */}
            {torneo.formato === 'copa_davis' ? (
                <div className="mt-8">
                    {!rivalClubData ? (
                        <div className="p-6 border border-dashed border-ochre/30 rounded-xl bg-ochre/5 text-center">
                            <p className="text-ochre font-semibold">Este torneo Copa Davis no tiene club rival asignado.</p>
                            <p className="text-xs text-olive/70 mt-1">Edítalo desde la configuración para asignar uno.</p>
                        </div>
                    ) : (
                        <>
                        {/* Serie ida/vuelta: enlace de trazabilidad + crear vuelta */}
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                {serieEnlace ? (
                                    <Link href={`/club/torneos/${serieEnlace.id}`}
                                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5 hover:bg-emerald-500/20 transition-colors">
                                        🔗 {serieEnlace.esVuelta ? 'Ver Vuelta' : 'Ver Ida'}: {serieEnlace.nombre}
                                    </Link>
                                ) : (torneo.reglas_puntuacion?.copa_serie?.rol === 'vuelta' && (
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-widest text-[10px]">
                                        Torneo de vuelta
                                    </Badge>
                                ))}
                            </div>
                            {puedeCrearVuelta && (
                                <CrearVueltaCopaDialog
                                    torneoIdaId={params.id}
                                    torneoIdaNombre={torneo.nombre || 'Copa Davis'}
                                    clubLocal={{ id: String(clubInfo?.id || torneo.club_id), nombre: clubInfo?.nombre || 'Local' }}
                                    clubRival={rivalClubData}
                                    categoriasIda={torneo.reglas_puntuacion?.categorias_habilitadas || []}
                                    partidosIdaPorCategoria={Object.fromEntries(
                                        Object.entries(
                                            (torneo.reglas_puntuacion?.copa_categorias_config || {}) as Record<string, { partidos?: number }>
                                        ).map(([cat, cfg]) => [cat, cfg?.partidos || 2])
                                    )}
                                    fechaFinIda={torneo.fecha_fin}
                                />
                            )}
                        </div>
                        <PersistentTabs defaultValue="copa" className="w-full">
                            <TabsList className="bg-paper-soft border border-olive/20 p-1 w-full flex overflow-x-auto justify-start sm:w-auto overflow-y-hidden">
                                <TabsTrigger value="copa" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-paper-dark">
                                    Marcador y Partidos
                                    <Badge variant="secondary" className="ml-2 bg-paper-dark text-olive border-none">{(partidosReales || []).length}</Badge>
                                </TabsTrigger>
                                <TabsTrigger value="cronograma" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-paper-dark">Parrilla (Programación)</TabsTrigger>
                            </TabsList>

                            <TabsContent value="copa" className="mt-6">
                                <CopaDavisManager
                                    torneoId={params.id}
                                    clubLocal={{ id: String(clubInfo?.id || torneo.club_id), nombre: clubInfo?.nombre || 'Local' }}
                                    clubRival={rivalClubData}
                                    partidos={partidosReales as unknown as Parameters<typeof CopaDavisManager>[0]['partidos']}
                                    tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                                    parejaPlayers={parejaPlayersMap}
                                    inscripciones={inscripcionesCopa as unknown as Parameters<typeof CopaDavisManager>[0]['inscripciones']}
                                    inscripcionesJugadores={inscripcionesJugadores}
                                    categoriasHabilitadas={torneo.reglas_puntuacion?.categorias_habilitadas || []}
                                    currentClubId={currentClubIdCopa}
                                    serie={serieEnlace && seriePuntosEnlace ? {
                                        esteEsVuelta: !serieEnlace.esVuelta,
                                        otroNombre: serieEnlace.nombre,
                                        otroLocal: seriePuntosEnlace.local,
                                        otroRival: seriePuntosEnlace.rival,
                                    } : null}
                                />
                            </TabsContent>

                            <TabsContent value="cronograma" className="mt-6">
                                <div className="mb-4 flex justify-end">
                                    <EditarCanchasControl
                                        torneoId={params.id}
                                        canchasActuales={torneo.reglas_puntuacion?.config_canchas || 2}
                                    />
                                </div>
                                <TournamentChronogram
                                    torneoId={params.id}
                                    matches={partidosReales}
                                    config={{
                                        duracion: torneo.reglas_puntuacion?.config_duracion || 60,
                                        canchas: torneo.reglas_puntuacion?.config_canchas || 2
                                    }}
                                    tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                                    parejaPlayers={parejaPlayersMap}
                                    copaDavisContext={{
                                        clubLocal: { id: String(clubInfo?.id || torneo.club_id), nombre: clubInfo?.nombre || 'Local' },
                                        clubRival: rivalClubData,
                                        categoriasSugeridas: torneo.reglas_puntuacion?.categorias_habilitadas || [],
                                        currentClubId: currentClubIdCopa,
                                    }}
                                />
                            </TabsContent>
                        </PersistentTabs>
                        </>
                    )}
                </div>
            ) : (
            <PersistentTabs defaultValue="participantes" className="w-full mt-8">
                <TabsList className="bg-paper-soft border border-olive/20 p-1 w-full flex overflow-x-auto justify-start sm:w-auto overflow-y-hidden">
                    <TabsTrigger value="participantes" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-paper-dark">Parejas Inscritas <Badge variant="secondary" className="ml-2 bg-paper-dark text-olive border-none">{allParticipants.length}</Badge></TabsTrigger>
                    <TabsTrigger value="grupos" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-paper-dark">Fase de Grupos</TabsTrigger>
                    <TabsTrigger value="eliminatorias" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-paper-dark">Fases Finales (Llaves)</TabsTrigger>
                    <TabsTrigger value="resultados" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-paper-dark">
                        Resultados
                        {pendientesCount > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-ochre/15 text-ochre-soft border border-ochre/30">{pendientesCount}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="cronograma" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-paper-dark">Parrilla (Programación)</TabsTrigger>
                </TabsList>

                <TabsContent value="grupos" className="mt-6">
                    <TournamentGroupsManager
                        torneoId={params.id}
                        categorias={categoriasConInscritos.length > 0 ? categoriasConInscritos : categoriasHabilitadas}
                        gruposExistentes={gruposExistentes || []}
                        partidos={partidosReales || []}
                        tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                        tipoDesempatePorCategoria={torneo.reglas_puntuacion?.tipo_desempate_por_categoria || {}}
                        allParticipants={allParticipants}
                        formato={torneo.formato || 'relampago'}
                        parejaPlayers={parejaPlayersMap}
                        configClasifican={torneo.reglas_puntuacion?.config_clasifican_por_grupo}
                        setsCantidad={torneo.reglas_puntuacion?.sets}
                        ordenGrupos={torneo.reglas_puntuacion?.orden_grupos || {}}
                    />
                </TabsContent>

                <TabsContent value="resultados" className="mt-6">
                    <TournamentResultsManager
                        torneoId={params.id}
                        partidos={partidosReales}
                        categorias={categoriasAMostrar}
                        tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                        userMap={reporterMap}
                        parejaPlayers={parejaPlayersMap}
                        setsCantidad={torneo.reglas_puntuacion?.sets}
                    />
                </TabsContent>

                <TabsContent value="cronograma" className="mt-6">
                    <div className="mb-4 flex justify-end">
                        <EditarCanchasControl
                            torneoId={params.id}
                            canchasActuales={torneo.reglas_puntuacion?.config_canchas || 1}
                        />
                    </div>
                    <TournamentChronogram
                        torneoId={params.id}
                        matches={partidosReales}
                        config={{
                            duracion: torneo.reglas_puntuacion?.config_duracion || 60,
                            canchas: torneo.reglas_puntuacion?.config_canchas || 1
                        }}
                        tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                        parejaPlayers={parejaPlayersMap}
                        setsCantidad={torneo.reglas_puntuacion?.sets}
                    />
                </TabsContent>

                <TabsContent value="participantes" className="mt-6">
                    {/* ... (existing content) */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-ink uppercase tracking-wider">Parejas Inscritas</h3>
                        {(rawPartidos || []).length === 0 && (
                            <AddTournamentPlayerModal torneoId={params.id} categorias={categoriasHabilitadas} esMaster={torneo.tipo === 'master'} />
                        )}
                    </div>
                    {allParticipants.length === 0 ? (
                        <div className="text-center py-12 text-olive/70 border border-olive/20 border-dashed rounded-xl bg-paper-soft/30">
                            <Users className="w-12 h-12 text-olive/40 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-ink mb-2 font-bold uppercase">Aún no hay inscritos</h3>
                            <p className="max-w-md mx-auto text-xs opacity-70">Comparte este torneo con los jugadores. Pronto verás aquí la lista de parejas confirmadas.</p>
                        </div>
                    ) : (
                        <div className="bg-paper-soft border border-olive/20 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left rtl:text-right text-olive">
                                <thead className="text-xs text-ink uppercase bg-paper-dark/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Pareja</th>
                                        <th scope="col" className="px-6 py-3">Categoría</th>
                                        <th scope="col" className="px-6 py-3">Estado de Pago</th>
                                        <th scope="col" className="px-6 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allParticipants.map((tp) => (
                                        <tr key={tp.id} className="bg-paper-soft border-b border-olive/20 hover:bg-paper-dark/30">
                                            <td className="px-6 py-4 font-bold text-ink">
                                                {tp.nombre}
                                            </td>
                                            <td className="px-6 py-4">
                                                {tp.categoria}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className={tp.estado_pago === 'pagado' ? 'text-olive border-olive/30 bg-olive-light/10' : 'text-ochre border-ochre-soft/30 bg-amber-400/10'}>
                                                    {tp.estado_pago}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <AdminParticipantActions 
                                                    id={tp.id.toString()} 
                                                    parejaId={tp.pareja_id}
                                                    tipo={tp.tipo} 
                                                    torneoId={params.id} 
                                                    hasStarted={hasStarted} 
                                                    j1Id={tp.jugador1_id}
                                                    j2Id={tp.jugador2_id}
                                                    estadoPago={tp.estado_pago}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="eliminatorias" className="mt-6">
                    <div className="space-y-12">
                        <TournamentBracketManager
                            categorias={categoriasAMostrar}
                            partidos={partidosReales}
                            tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                            parejaPlayers={parejaPlayersMap}
                            setsCantidad={torneo.reglas_puntuacion?.sets}
                            formato={torneo.formato || 'relampago'}
                            clasificanPorGrupoDefault={torneo.reglas_puntuacion?.config_clasifican_por_grupo}
                            allParticipants={allParticipants}
                        />

                        {/* SECCIÓN HISTORIAL DE GRUPOS */}
                        <div className="opacity-60 hover:opacity-100 transition-opacity">
                            <h3 className="text-lg font-bold text-olive/70 mb-6 uppercase tracking-widest pl-2 border-l-2 border-olive/20">Historial de Fase de Grupos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {partidosReales.filter(p => p.torneo_grupo_id).map((match) => (
                                    <div key={match.id} className="bg-paper-soft/50 border border-olive/20 rounded-xl p-4 flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="text-[10px] text-olive/50 font-bold mb-1 uppercase italic">{match.pareja1?.nombre_pareja} vs {match.pareja2?.nombre_pareja}</div>
                                            <div className="text-xs font-black text-olive tracking-tighter">{match.resultado || "Pendiente"}</div>
                                        </div>
                                        <Badge className="bg-paper-dark text-olive/70 text-[8px] uppercase">{match.estado}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </PersistentTabs>
            )}
        </div>
    );
}
