"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Users, Coins, Trophy, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { BotonUnirsePartido } from "./BotonUnirsePartido";
import { BotonCancelarPartido } from "./BotonCancelarPartido";

interface Partido {
    id: string;
    fecha: string;
    lugar: string;
    nivel: string;
    sexo: string;
    tipo_partido: string;
    estado: string;
    cupos_disponibles: number;
    precio_por_persona: number;
    creador?: { nombre: string };
    creador_id?: string;
    resultado?: string;
}

interface Jugador {
    id: string;
    jugador_id: string;
    jugador: {
        nombre: string;
        nivel: string;
    };
}

interface Props {
    partido: Partido;
    trigger: React.ReactNode;
    userId?: string;
}

export function DetallePartidoDialog({ partido, trigger, userId: propUserId }: Props) {
    const [open, setOpen] = useState(false);
    const [userId, setUserId] = useState<string | null>(propUserId || null);
    const [jugadores, setJugadores] = useState<Jugador[]>([]);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        if (!userId) {
            const getSession = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) setUserId(user.id);
            };
            getSession();
        }
    }, [userId, supabase.auth]);

    useEffect(() => {
        if (open) {
            setLoading(true);
            const fetchJugadores = async () => {
                const { data } = await supabase
                    .from('partido_jugadores')
                    .select(`
                        id,
                        jugador_id,
                        jugador:users(nombre, nivel)
                    `)
                    .eq('partido_id', partido.id);

                if (data) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setJugadores(data as any[]);
                }
                setLoading(false);
            };
            fetchJugadores();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, partido.id]);

    const isPast = new Date(partido.fecha) < new Date();
    const isPlayed = isPast || partido.estado === 'jugado';

    // Si estado dice 'abierto' pero es del pasado, lo forzamos visualmente a Jugado o Cerrado
    const displayStatus = isPlayed && partido.estado === 'abierto' ? 'Jugado' :
        partido.estado === 'abierto' ? 'Buscando Jugadores' :
            partido.estado.charAt(0).toUpperCase() + partido.estado.slice(1);

    const formatPrice = (price: number) => {
        return price > 0 ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(price) : 'Gratis';
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-paper-soft border-olive/20 text-ink p-0 overflow-hidden">
                {/* Header Background */}
                <div className="relative h-32 bg-paper border-b border-olive/20 flex items-end p-6">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent z-0" />
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1628126284698-b80c10faeeaa?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay z-0" />
                    <div className="relative z-10 w-full flex justify-between items-end">
                        <div>
                            <Badge variant="outline" className={`mb-2 border-0 ${isPlayed ? 'bg-paper-dark text-olive' : 'bg-olive/20 text-olive'}`}>
                                {displayStatus}
                            </Badge>
                            <DialogTitle className="text-2xl font-black text-ink leading-none">
                                Partido {partido.tipo_partido}
                            </DialogTitle>
                        </div>
                        <div className="text-right">
                            <Badge variant="secondary" className="bg-paper-dark text-ink pointer-events-none">
                                Lvl {partido.nivel} • {partido.sexo}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-3 bg-paper/50 p-3 rounded-xl border border-olive/20">
                            <Clock className="w-5 h-5 text-olive mt-0.5" />
                            <div>
                                <div className="text-xs text-olive/70 font-medium">Fecha y Hora</div>
                                <div className="text-sm font-bold text-ink">
                                    {new Date(partido.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-paper/50 p-3 rounded-xl border border-olive/20">
                            <MapPin className="w-5 h-5 text-olive mt-0.5" />
                            <div>
                                <div className="text-xs text-olive/70 font-medium">Lugar</div>
                                <div className="text-sm font-bold text-ink line-clamp-2">
                                    {partido.lugar}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-paper/50 p-3 rounded-xl border border-olive/20">
                            <Coins className="w-5 h-5 text-ochre-dark mt-0.5" />
                            <div>
                                <div className="text-xs text-olive/70 font-medium">Costo por persona</div>
                                <div className="text-sm font-bold text-ink">
                                    {formatPrice(partido.precio_por_persona)}
                                </div>
                            </div>
                        </div>
                        {isPlayed && (
                            <div className="flex items-start gap-3 bg-paper/50 p-3 rounded-xl border border-olive/20">
                                <Trophy className="w-5 h-5 text-ochre-dark mt-0.5" />
                                <div>
                                    <div className="text-xs text-olive/70 font-medium">Resultado</div>
                                    <div className="text-sm font-bold text-ochre">
                                        {partido.resultado || "Por definir"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Players Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-ink flex items-center gap-2">
                                <Users className="w-4 h-4 text-olive" />
                                Jugadores ({jugadores.length + 1}/4)
                            </h3>
                            {!isPlayed && partido.cupos_disponibles > 0 && (
                                <span className="text-xs text-ochre-dark font-medium bg-ochre/10 px-2 py-1 rounded border border-ochre/20">
                                    Faltan {partido.cupos_disponibles}
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="animate-pulse space-y-2">
                                <div className="h-12 bg-paper-dark rounded-xl" />
                                <div className="h-12 bg-paper-dark rounded-xl" />
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Organizador (Siempre está) */}
                                <div className="flex items-center gap-3 bg-paper-dark/50 p-3 rounded-xl border border-olive/30">
                                    <Avatar className="w-10 h-10 border-2 border-olive/50">
                                        <AvatarFallback className="bg-paper-soft text-olive font-bold">
                                            {partido.creador?.nombre ? partido.creador.nombre.substring(0, 2).toUpperCase() : "OR"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-ink">{partido.creador?.nombre || "Organizador"}</div>
                                        <div className="text-xs text-olive">Organizador</div>
                                    </div>
                                    <Badge variant="outline" className="border-neutral-600 text-olive">Owner</Badge>
                                </div>

                                {/* Otros Jugadores Inscritos */}
                                {jugadores.map((j) => (
                                    <div key={j.id} className="flex items-center gap-3 bg-paper-soft p-3 rounded-xl border border-olive/20">
                                        <Avatar className="w-10 h-10 border border-olive/30">
                                            <AvatarFallback className="bg-paper-dark text-ink font-bold">
                                                {j.jugador?.nombre ? j.jugador.nombre.substring(0, 2).toUpperCase() : "JG"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="font-bold text-sm text-ink">{j.jugador?.nombre || "Jugador Oculto"}</div>
                                            <div className="text-xs text-olive/70">Lvl {j.jugador?.nivel || "N/A"}</div>
                                        </div>
                                    </div>
                                ))}

                                {/* Huecos vacíos */}
                                {!isPlayed && Array.from({ length: partido.cupos_disponibles }).map((_, i) => (
                                    <div key={`empty-${i}`} className="flex items-center gap-3 bg-paper p-3 rounded-xl border border-olive/20 border-dashed opacity-70">
                                        <div className="w-10 h-10 rounded-full border-2 border-olive/20 border-dashed flex items-center justify-center bg-paper-soft">
                                            <span className="text-olive/50 text-xs">?</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-olive/70 italic">Cupo Disponible</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    {!isPlayed && userId && (
                        <div className="pt-4 border-t border-olive/20">
                            {partido.creador_id === userId ? (
                                <BotonCancelarPartido
                                    partidoId={partido.id}
                                    partidoFecha={partido.fecha}
                                    fullWidth
                                />
                            ) : (
                                <BotonUnirsePartido
                                    partidoId={partido.id}
                                    userId={userId}
                                    yaInscrito={jugadores.some(j => j.jugador_id === userId)}
                                    cuposDisponibles={partido.cupos_disponibles}
                                    partidoFecha={partido.fecha}
                                    fullWidth
                                />
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
