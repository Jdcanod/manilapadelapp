"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MapPin, Users, Coins, Trophy, Clock, Swords } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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
    resultado?: string;
}

interface Jugador {
    id: string;
    jugador: {
        nombre: string;
        nivel: string;
    };
}

interface Props {
    partido: Partido;
    trigger: React.ReactNode;
}

export function DetallePartidoDialog({ partido, trigger }: Props) {
    const [open, setOpen] = useState(false);
    const [jugadores, setJugadores] = useState<Jugador[]>([]);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        if (open) {
            setLoading(true);
            const fetchJugadores = async () => {
                const { data } = await supabase
                    .from('partido_jugadores')
                    .select(`
                        id,
                        jugador:users(nombre, nivel)
                    `)
                    .eq('partido_id', partido.id);

                if (data) {
                    setJugadores(data as any[]);
                }
                setLoading(false);
            };
            fetchJugadores();
        }
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
            <DialogContent className="sm:max-w-[500px] bg-neutral-900 border-neutral-800 text-neutral-100 p-0 overflow-hidden">
                {/* Header Background */}
                <div className="relative h-32 bg-neutral-950 border-b border-neutral-800 flex items-end p-6">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent z-0" />
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1628126284698-b80c10faeeaa?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay z-0" />
                    <div className="relative z-10 w-full flex justify-between items-end">
                        <div>
                            <Badge variant="outline" className={`mb-2 border-0 ${isPlayed ? 'bg-neutral-800 text-neutral-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                {displayStatus}
                            </Badge>
                            <DialogTitle className="text-2xl font-black text-white leading-none">
                                Partido {partido.tipo_partido}
                            </DialogTitle>
                        </div>
                        <div className="text-right">
                            <Badge variant="secondary" className="bg-neutral-800 text-neutral-300 pointer-events-none">
                                Lvl {partido.nivel} • {partido.sexo}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                            <Clock className="w-5 h-5 text-emerald-500 mt-0.5" />
                            <div>
                                <div className="text-xs text-neutral-500 font-medium">Fecha y Hora</div>
                                <div className="text-sm font-bold text-neutral-200">
                                    {new Date(partido.fecha).toLocaleString('es-CO', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                            <MapPin className="w-5 h-5 text-emerald-500 mt-0.5" />
                            <div>
                                <div className="text-xs text-neutral-500 font-medium">Lugar</div>
                                <div className="text-sm font-bold text-neutral-200 line-clamp-2">
                                    {partido.lugar}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                            <Coins className="w-5 h-5 text-amber-500 mt-0.5" />
                            <div>
                                <div className="text-xs text-neutral-500 font-medium">Costo por persona</div>
                                <div className="text-sm font-bold text-neutral-200">
                                    {formatPrice(partido.precio_por_persona)}
                                </div>
                            </div>
                        </div>
                        {isPlayed && (
                            <div className="flex items-start gap-3 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                                <Trophy className="w-5 h-5 text-amber-500 mt-0.5" />
                                <div>
                                    <div className="text-xs text-neutral-500 font-medium">Resultado</div>
                                    <div className="text-sm font-bold text-amber-400">
                                        {partido.resultado || "Por definir"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Players Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <Users className="w-4 h-4 text-emerald-500" />
                                Jugadores ({jugadores.length + 1}/4)
                            </h3>
                            {!isPlayed && partido.cupos_disponibles > 0 && (
                                <span className="text-xs text-amber-500 font-medium bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                                    Faltan {partido.cupos_disponibles}
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="animate-pulse space-y-2">
                                <div className="h-12 bg-neutral-800 rounded-xl" />
                                <div className="h-12 bg-neutral-800 rounded-xl" />
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {/* Organizador (Siempre está) */}
                                <div className="flex items-center gap-3 bg-neutral-800/50 p-3 rounded-xl border border-neutral-700/50">
                                    <Avatar className="w-10 h-10 border-2 border-emerald-500/50">
                                        <AvatarFallback className="bg-neutral-900 text-emerald-500 font-bold">
                                            {partido.creador?.nombre ? partido.creador.nombre.substring(0, 2).toUpperCase() : "OR"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-white">{partido.creador?.nombre || "Organizador"}</div>
                                        <div className="text-xs text-emerald-500">Organizador</div>
                                    </div>
                                    <Badge variant="outline" className="border-neutral-600 text-neutral-400">Owner</Badge>
                                </div>

                                {/* Otros Jugadores Inscritos */}
                                {jugadores.map((j) => (
                                    <div key={j.id} className="flex items-center gap-3 bg-neutral-900 p-3 rounded-xl border border-neutral-800">
                                        <Avatar className="w-10 h-10 border border-neutral-700">
                                            <AvatarFallback className="bg-neutral-800 text-neutral-300 font-bold">
                                                {j.jugador?.nombre ? j.jugador.nombre.substring(0, 2).toUpperCase() : "JG"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="font-bold text-sm text-neutral-200">{j.jugador?.nombre || "Jugador Oculto"}</div>
                                            <div className="text-xs text-neutral-500">Lvl {j.jugador?.nivel || "N/A"}</div>
                                        </div>
                                    </div>
                                ))}

                                {/* Huecos vacíos */}
                                {!isPlayed && Array.from({ length: partido.cupos_disponibles }).map((_, i) => (
                                    <div key={`empty-${i}`} className="flex items-center gap-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800/50 border-dashed opacity-70">
                                        <div className="w-10 h-10 rounded-full border-2 border-neutral-800 border-dashed flex items-center justify-center bg-neutral-900">
                                            <span className="text-neutral-600 text-xs">?</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-neutral-500 italic">Cupo Disponible</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
