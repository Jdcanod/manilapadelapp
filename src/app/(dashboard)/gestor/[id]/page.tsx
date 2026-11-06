export const dynamic = 'force-dynamic';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, CalendarDays, Swords } from "lucide-react";
import { formatPairName, formatFormatoLabel } from "@/lib/display-names";
import { PanelGestor } from "@/components/PanelGestor";

/**
 * La pantalla del gestor de un torneo.
 *
 * Es una vista propia y no la del club con botones escondidos: así el gestor
 * no puede tocar lo que no ve, y cuando mañana agreguemos una acción nueva al
 * panel del club no se cuela aquí por olvido.
 *
 * Solo hace dos cosas, que son las que el club delega: cargar resultados y
 * programar partidos.
 */
export default async function GestorTorneoPage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const admin = createPureAdminClient();
    const { data: userData } = await admin
        .from('users').select('id, nombre, rol').eq('auth_id', user.id).single();
    if (!userData) redirect("/login");

    const { data: torneo } = await admin
        .from('torneos')
        .select('id, nombre, formato, fecha_inicio, fecha_fin, club_id, reglas_puntuacion')
        .eq('id', params.id)
        .single();
    if (!torneo) redirect("/jugador");

    // El club dueño entra a su propio panel, que puede más que este.
    const esClub = userData.rol === 'admin_club' && String(torneo.club_id) === String(userData.id);
    if (esClub) redirect(`/club/torneos/${params.id}`);

    const { data: gestor } = await admin
        .from('torneo_gestores')
        .select('id')
        .eq('torneo_id', params.id)
        .eq('jugador_id', userData.id)
        .maybeSingle();
    if (!gestor) redirect("/jugador");

    const { data: partidos } = await admin
        .from('partidos')
        .select('id, fecha, lugar, nivel, estado, estado_resultado, resultado, pareja1_id, pareja2_id, es_revancha, walkover_ganador_id, torneo_grupo_id')
        .eq('torneo_id', params.id)
        .order('fecha', { ascending: true });

    // Nombres de pareja ya resueltos: el gestor necesita reconocer a la gente,
    // no descifrar identificadores.
    const parejaIds = Array.from(new Set((partidos || []).flatMap((p: { pareja1_id: string | null; pareja2_id: string | null }) => [p.pareja1_id, p.pareja2_id]).filter(Boolean) as string[]));
    const { data: parejas } = parejaIds.length
        ? await admin.from('parejas').select('id, jugador1_id, jugador2_id').in('id', parejaIds)
        : { data: [] };
    const jugadorIds = Array.from(new Set((parejas || []).flatMap((p: { jugador1_id: string | null; jugador2_id: string | null }) => [p.jugador1_id, p.jugador2_id]).filter(Boolean) as string[]));
    const { data: jugadores } = jugadorIds.length
        ? await admin.from('users').select('id, nombre, apellido, email').in('id', jugadorIds)
        : { data: [] };

    const jugadorMap = new Map((jugadores || []).map((j: { id: string }) => [j.id, j]));
    const nombrePareja = new Map<string, string>();
    // Las parejas donde juega el gestor: en esas no puede cargar el resultado.
    const parejasDelGestor = new Set<string>();
    for (const p of parejas || []) {
        const j1 = p.jugador1_id ? jugadorMap.get(p.jugador1_id) : null;
        const j2 = p.jugador2_id ? jugadorMap.get(p.jugador2_id) : null;
        nombrePareja.set(p.id, formatPairName(j1 ?? null, j2 ?? null) || "Pareja");
        if (p.jugador1_id === userData.id || p.jugador2_id === userData.id) parejasDelGestor.add(p.id);
    }

    const canchas = (torneo.reglas_puntuacion as { config_canchas?: number })?.config_canchas || 4;

    return (
        <div className="space-y-5">
            <div className="flex items-start gap-3">
                <Link
                    href="/jugador"
                    className="p-2 bg-paper-soft border border-olive/20 rounded-xl hover:bg-paper-dark transition-colors text-ink mt-0.5 shrink-0"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-ochre-dark">Estás gestionando</p>
                    <h1 className="text-2xl font-bold tracking-tight text-ink leading-tight">{torneo.nombre}</h1>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-olive mt-1.5">
                        <span className="flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5 text-olive/70" />
                            {new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')}
                        </span>
                        <span className="flex items-center gap-1">
                            <Swords className="w-3.5 h-3.5 text-olive/70" />
                            {formatFormatoLabel(torneo.formato)}
                        </span>
                    </div>
                </div>
            </div>

            <PanelGestor
                torneoId={params.id}
                canchas={canchas}
                partidos={(partidos || []).map((p: Record<string, any>) => ({
                    id: p.id,
                    fecha: p.fecha,
                    lugar: p.lugar,
                    nivel: p.nivel,
                    estado: p.estado,
                    estadoResultado: p.estado_resultado,
                    resultado: p.resultado,
                    esRevancha: !!p.es_revancha,
                    ganoPorW: !!p.walkover_ganador_id,
                    pareja1Id: p.pareja1_id,
                    pareja2Id: p.pareja2_id,
                    pareja1: p.pareja1_id ? (nombrePareja.get(p.pareja1_id) || "TBD") : "TBD",
                    pareja2: p.pareja2_id ? (nombrePareja.get(p.pareja2_id) || "TBD") : "TBD",
                    juegaElGestor: !!(
                        (p.pareja1_id && parejasDelGestor.has(p.pareja1_id)) ||
                        (p.pareja2_id && parejasDelGestor.has(p.pareja2_id))
                    ),
                }))}
            />
        </div>
    );
}
