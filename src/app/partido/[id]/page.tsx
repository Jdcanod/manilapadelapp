import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, Users, Coins, ArrowRight } from "lucide-react";
import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { BrandLogo } from "@/components/BrandLogo";
import { BotonUnirsePartido } from "@/components/BotonUnirsePartido";
import { CompartirPartidoButton } from "@/components/CompartirPartidoButton";
import { ESTADO_AMISTOSO, describirNivel, puedeUnirsePorCategoria } from "@/lib/amistosos";
import { obtenerCategoriaJugador } from "@/lib/ranking/categoriaJugador";

export const dynamic = 'force-dynamic';

/**
 * Página PÚBLICA de un amistoso — es el destino de los links que se comparten
 * por WhatsApp, así que tiene que abrir sin sesión. Vive en /partido/[id]
 * (singular) a propósito: /partidos está protegido por el middleware.
 *
 * Como puede no haber sesión, el partido se lee con el cliente de servicio
 * (RLS sobre `partidos` exige usuario autenticado). Solo se expone información
 * no sensible del partido.
 */

async function cargarPartido(id: string) {
    const admin = createPureAdminClient();
    const { data } = await admin
        .from('partidos')
        .select('id, torneo_id, fecha, lugar, nivel, categoria_rango, sexo, cupos_totales, cupos_disponibles, precio_por_persona, estado, creador_id')
        .eq('id', id)
        .maybeSingle();
    return data;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
    const partido = await cargarPartido(params.id);
    if (!partido) return { title: "Partido no encontrado — Pádel Manía" };

    const cuando = new Date(partido.fecha).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
    return {
        title: `Partido en ${partido.lugar} — Pádel Manía`,
        description: `${cuando} · ${describirNivel(partido.nivel, partido.categoria_rango)} · faltan ${partido.cupos_disponibles} jugadores.`,
    };
}

export default async function PartidoPublicoPage({ params }: { params: { id: string } }) {
    const partido = await cargarPartido(params.id);
    if (!partido || partido.torneo_id) notFound();

    const admin = createPureAdminClient();

    const { data: creador } = await admin
        .from('users')
        .select('nombre')
        .eq('auth_id', partido.creador_id)
        .maybeSingle();

    // ¿Hay alguien logueado? De eso depende el CTA.
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    interface PerfilViewer { id: string; rol: string; club_id: string | null }
    let perfil: PerfilViewer | null = null;
    let yaInscrito = false;
    let miCategoria: string | null = null;

    if (user) {
        const { data } = await admin
            .from('users')
            .select('id, rol, club_id')
            .eq('auth_id', user.id)
            .maybeSingle();
        perfil = (data as PerfilViewer | null) ?? null;

        if (perfil?.rol === 'jugador') {
            const { data: inscripcion } = await admin
                .from('partido_jugadores')
                .select('id')
                .eq('partido_id', partido.id)
                .eq('jugador_id', user.id)
                .maybeSingle();
            yaInscrito = !!inscripcion || partido.creador_id === user.id;

            miCategoria = (await obtenerCategoriaJugador(admin, perfil.id, perfil.club_id)).categoria;
        }
    }

    const esJugador = perfil?.rol === 'jugador';
    const encajaCategoria = puedeUnirsePorCategoria(miCategoria, partido.nivel, partido.categoria_rango);
    const yaPaso = new Date(partido.fecha) < new Date();
    const abierto = partido.estado === ESTADO_AMISTOSO.ABIERTO && !yaPaso;

    const cuando = new Date(partido.fecha).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });

    // Para que login/registro devuelvan a este mismo partido al terminar.
    const volverAqui = encodeURIComponent(`/partido/${partido.id}`);

    let aviso: string | null = null;
    if (yaPaso) aviso = "Este partido ya pasó.";
    else if (partido.estado === ESTADO_AMISTOSO.CANCELADO) aviso = "Este partido fue cancelado.";
    else if (partido.estado === ESTADO_AMISTOSO.COMPLETO) aviso = "Este partido ya está completo.";
    else if (esJugador && !encajaCategoria) aviso = `Este partido es para ${partido.nivel} y tu categoría es ${miCategoria}.`;

    return (
        <main className="min-h-screen bg-paper text-ink">
            <nav className="max-w-2xl mx-auto flex justify-between items-center px-6 py-5">
                <BrandLogo size="sm" href={user ? "/jugador" : "/"} />
                {!user && (
                    <Link href={`/login?next=${volverAqui}`} className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">
                        Iniciar sesión
                    </Link>
                )}
            </nav>

            <div className="max-w-2xl mx-auto px-6 pb-16">
                <div className="rounded-3xl border border-olive/20 bg-paper-soft p-7">
                    <p className="font-display text-[13px] tracking-[0.22em] uppercase text-ochre-dark mb-2">
                        Partido amistoso
                    </p>
                    <h1 className="font-display text-4xl sm:text-5xl leading-[0.95] mb-6">{partido.lugar}</h1>

                    <dl className="space-y-3 text-sm">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-olive shrink-0" />
                            <span className="capitalize">{cuando}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-olive shrink-0" />
                            <span>{describirNivel(partido.nivel, partido.categoria_rango)} · {partido.sexo}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Users className="w-4 h-4 text-olive shrink-0" />
                            <span>
                                {partido.cupos_disponibles > 0
                                    ? `Faltan ${partido.cupos_disponibles} de ${partido.cupos_totales} jugadores`
                                    : `Completo (${partido.cupos_totales} jugadores)`}
                            </span>
                        </div>
                        {partido.precio_por_persona > 0 && (
                            <div className="flex items-center gap-3">
                                <Coins className="w-4 h-4 text-olive shrink-0" />
                                <span>${Number(partido.precio_por_persona).toLocaleString('es-CO')} por persona</span>
                            </div>
                        )}
                    </dl>

                    {creador?.nombre && (
                        <p className="text-xs text-olive/60 mt-5">Organiza {creador.nombre}</p>
                    )}

                    {aviso && (
                        <p className="mt-6 text-sm text-ochre-dark bg-ochre/10 border border-ochre/30 rounded-xl px-4 py-3">
                            {aviso}
                        </p>
                    )}

                    <div className="mt-7 flex flex-wrap gap-3">
                        {esJugador && abierto && encajaCategoria && (
                            <BotonUnirsePartido
                                partidoId={partido.id}
                                userId={user!.id}
                                yaInscrito={yaInscrito}
                                cuposDisponibles={partido.cupos_disponibles}
                                partidoFecha={partido.fecha}
                                partidoCreadorId={partido.creador_id}
                            />
                        )}

                        {!user && (
                            <Link
                                href={`/registro?next=${volverAqui}`}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-display text-base tracking-[0.08em] uppercase bg-olive text-paper hover:-translate-y-0.5 transition-transform"
                            >
                                Crear cuenta para unirme
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        )}

                        {abierto && (
                            <CompartirPartidoButton
                                partidoId={partido.id}
                                lugar={partido.lugar}
                                fecha={partido.fecha}
                                nivel={partido.nivel}
                                categoriaRango={partido.categoria_rango}
                                cuposDisponibles={partido.cupos_disponibles}
                                variante="full"
                            />
                        )}
                    </div>

                    {!user && (
                        <p className="text-[11px] text-olive/60 mt-4">
                            ¿Ya tienes cuenta? <Link href={`/login?next=${volverAqui}`} className="underline hover:text-olive">Inicia sesión</Link> y vuelves directo a este partido.
                        </p>
                    )}
                </div>

                {user && (
                    <div className="mt-6 text-center">
                        <Link href="/partidos" className="text-xs font-bold uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">
                            Ver todos los partidos
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
