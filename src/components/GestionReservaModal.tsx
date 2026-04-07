"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Trash2, Edit, Save, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
    reservationId: string | number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courts: string[]; // e.g. ["Cancha 1", "Cancha 2"]
    timeSlots: string[]; // e.g. ["06:00", "06:30", ...]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    horariosPrime?: any[];
    currentDateStr?: string;
}

interface User {
    auth_id: string;
    nombre: string;
    nivel: string;
}

interface Partido {
    id: number;
    fecha: string;
    lugar: string;
    tipo_partido?: string;
    estado?: string;
}

interface PartidoJugador {
    id: number;
    jugador: {
        nombre: string;
        nivel: string;
    }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function GestionReservaModal({ reservationId, open, onOpenChange, courts, timeSlots, horariosPrime }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [partido, setPartido] = useState<Partido | null>(null);
    const [jugadores, setJugadores] = useState<PartidoJugador[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    const [editCourtMode, setEditCourtMode] = useState(false);
    const [selectedCourt, setSelectedCourt] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState("");
    const [selectedUserId, setSelectedUserId] = useState("");
    const [addedName, setAddedName] = useState("");

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        if (open && reservationId) {
            setLoading(true);
            setEditCourtMode(false);
            setAddedName("");
            
            const fetchInfo = async () => {
                const { data: pData } = await supabase.from('partidos').select('*').eq('id', reservationId).single();
                setPartido(pData);
                
                if (pData) {
                    const { data: jData } = await supabase.from('partido_jugadores').select('id, jugador:users(nombre, nivel)').eq('partido_id', pData.id);
                    setJugadores(jData || []);
                    
                    // Extraer cancha actual. Soportamos tanto "cancha_1" como "Cancha 1"
                    const match = pData.lugar.match(/cancha[_\s](\d+)/i);
                    if (match) {
                        setSelectedCourt(`cancha_${match[1]}`);
                    }

                    // Extraer fecha y hora actual (ajustado a Colombia)
                    if (pData.fecha) {
                        const dt = new Date(pData.fecha);
                        const dateStr = dt.toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0];
                        const timeStr = dt.toLocaleString('en-GB', { 
                            timeZone: 'America/Bogota', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                        setSelectedDate(dateStr);
                        setSelectedTime(timeStr);
                    }
                }
                
                // Cargar jugadores registrados
                const { data: usersData } = await supabase.from('users').select('auth_id, nombre, nivel').eq('rol', 'jugador').order('nombre');
                setAllUsers(usersData || []);

                setLoading(false);
            };
            fetchInfo();
        }
    }, [open, reservationId, supabase]);

    const handleDelete = async () => {
        if (!confirm("¿Estás seguro de que deseas eliminar esta reserva por completo? Esta acción es irreversible.")) return;
        
        setSaving(true);
        // Borrar jugadores asociados primero para evitar errores de llave foránea (por si no hay cascade)
        await supabase.from('partido_jugadores').delete().eq('partido_id', reservationId);
        // Borrar reserva
        const { error } = await supabase.from('partidos').delete().eq('id', reservationId);
        
        setSaving(false);
        if (error) {
            alert("Error al eliminar la reserva: " + error.message);
        } else {
            alert("Reserva eliminada con éxito");
            onOpenChange(false);
            router.refresh();
        }
    };

    const handleSaveCourt = async () => {
        if (!selectedCourt) return;

        // Validar Horario Prime para reservas de 1 hora
        const is60min = partido?.lugar && /60\s?min/i.test(partido.lugar);
        const timeStrFromDate = partido?.fecha ? new Date(partido.fecha).toLocaleString('en-GB', { 
            timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' 
        }).replace('.', ':') : ""; // Asegurar formato HH:mm

        if (is60min && timeStrFromDate) {
            const isPrime = checkIsPrime(timeStrFromDate, selectedCourt);
            if (isPrime) {
                alert(`⚠️ RESTRICCIÓN PRIME: No se puede mover a esta cancha. En este horario (${timeStrFromDate}), la cancha seleccionada es PRIME y exige bloques de 90 minutos.`);
                return;
            }
        }

        setSaving(true);
        
        // Reemplazar la cancha antigua por la nueva en el string "lugar"
        const currentLugar = partido?.lugar || "";
        const newLugar = currentLugar.replace(/cancha[_\s]\d+/i, selectedCourt);
        
        const { error } = await supabase.from('partidos').update({ lugar: newLugar }).eq('id', reservationId);
        
        setSaving(false);
        if (error) {
            alert("Error al cambiar la cancha: " + error.message);
        } else {
            router.refresh();
            onOpenChange(false);
        }
    };

    const checkIsPrime = (hora: string, canchaId: string) => {
        if (!horariosPrime || !Array.isArray(horariosPrime)) return false;
        
        // Normalizar canchaId (ej: 'cancha_1' -> '1')
        const num = String(canchaId || '').replace('cancha_', '');
        
        for (const r of horariosPrime) {
            // Un rango aplica si es 'all' o coincide con el número de cancha
            const rangeCancha = String(r.cancha || '');
            if (rangeCancha === 'all' || rangeCancha === num) {
                // Si hay rango de fechas, validar
                if (r.fecha_inicio && selectedDate && selectedDate < r.fecha_inicio) continue;
                if (r.fecha_fin && selectedDate && selectedDate > r.fecha_fin) continue;
                
                // Comparar horas (formato HH:mm)
                if (hora >= r.hora_inicio && hora < r.hora_fin) return true;
            }
        }
        return false;
    };

    const handleSaveDateTime = async () => {
        if (!selectedDate || !selectedTime) return;

        // Validar Horario Prime para reservas de 1 hora
        // Regex flexible para "60 min", "60min", "60 min", etc.
        const is60min = partido?.lugar && /60\s?min/i.test(partido.lugar);
        
        if (is60min) {
            const isPrime = checkIsPrime(selectedTime, selectedCourt);
            if (isPrime) {
                alert(`⚠️ RESTRICCIÓN PRIME: El horario ${selectedTime} en esta cancha está configurado como PRIME. Las reservas PRIME deben ser de 90 minutos obligatoriamente. Esta reserva es de 60 minutos y no se puede mover aquí.`);
                return;
            }
        }

        setSaving(true);
        
        // Generar ISO con offset -05:00
        const newFecha = new Date(`${selectedDate}T${selectedTime}:00-05:00`).toISOString();
        
        const { error } = await supabase.from('partidos').update({ fecha: newFecha }).eq('id', reservationId);
        
        setSaving(false);
        if (error) {
            alert("Error al cambiar fecha/hora: " + error.message);
        } else {
            router.refresh();
            onOpenChange(false);
        }
    };

    const handleAddPlayerFormal = async () => {
        if (!selectedUserId) return;
        setSaving(true);
        
        const { error } = await supabase.from('partido_jugadores').insert({
            partido_id: reservationId,
            jugador_id: selectedUserId
        });
        
        if (error) {
            alert("Error al añadir jugador: " + error.message);
            setSaving(false);
        } else {
            // Recargar lista local
            const { data: jData } = await supabase.from('partido_jugadores').select('id, jugador:users(nombre, nivel)').eq('partido_id', reservationId);
            setJugadores(jData || []);
            setSelectedUserId("");
            setSaving(false);
        }
    };

    const handleRemovePlayer = async (pjId: number) => {
        if (!confirm("¿Seguro que deseas quitar a este jugador del partido?")) return;
        setSaving(true);
        const { error } = await supabase.from('partido_jugadores').delete().eq('id', pjId);
        if (error) {
            alert("Error al quitar jugador");
        } else {
            setJugadores(jugadores.filter(j => j.id !== pjId));
        }
        setSaving(false);
    };

    const handleAddPlayerText = async () => {
        if (!addedName.trim()) return;
        setSaving(true);
        
        const currentLugar = partido?.lugar || "";
        let newLugar = currentLugar;
        
        if (currentLugar.includes("a nombre de")) {
            newLugar = currentLugar + ", " + addedName.trim();
        } else {
            newLugar = currentLugar + " - Jugadores Adicionales: " + addedName.trim();
        }
        
        const { error } = await supabase.from('partidos').update({ lugar: newLugar }).eq('id', reservationId);
        
        setSaving(false);
        if (error) {
            alert("Error al añadir jugador: " + error.message);
        } else {
            router.refresh();
            onOpenChange(false);
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-neutral-900 border-neutral-800 text-neutral-100 max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
                <DialogHeader className="p-6 pb-2 border-b border-neutral-800/50">
                    <DialogTitle className="text-xl">Gestión de Reserva</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Edita los detalles de la reserva, asigna canchas o gestiona jugadores inscritos.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                        </div>
                    ) : !partido ? (
                        <div className="text-red-500 p-4">No se pudo cargar la reserva. Es posible que haya sido eliminada.</div>
                    ) : (
                        <div className="space-y-6 pt-2 pb-6">
                            {/* Info Básica: Fecha y Horario */}
                            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3 text-sm shadow-inner">
                                <div className="flex flex-col gap-2">
                                    <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Fecha y Horario</span>
                                    <div className="flex gap-2">
                                        <Input 
                                            type="date" 
                                            value={selectedDate} 
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                                            className="bg-neutral-900 border-neutral-800 text-white h-9 [color-scheme:dark] flex-1"
                                        />
                                        <Select value={selectedTime} onValueChange={setSelectedTime}>
                                            <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white h-9 w-[120px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[200px]">
                                                {timeSlots.map(t => (
                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button onClick={handleSaveDateTime} disabled={saving} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                            <Save className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-neutral-800/50">
                                    <span className="text-neutral-500">Tipo:</span>
                                    <span className="font-bold uppercase text-amber-500">{partido?.tipo_partido?.replace('_', ' ')}</span>
                                </div>
                            </div>

                            {/* Cambio de Cancha */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-sm text-emerald-400">Modificar Cancha Asignada</h4>
                                {!editCourtMode ? (
                                    <div className="flex items-center justify-between bg-neutral-950 px-4 py-2 rounded-lg border border-neutral-800">
                                        <span className="font-bold">
                                            {selectedCourt ? 
                                                (courts[parseInt(selectedCourt.split('_')[1]) - 1] || selectedCourt) 
                                                : "No detectada"}
                                        </span>
                                        <Button variant="ghost" size="sm" onClick={() => setEditCourtMode(true)} className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 h-8">
                                            <Edit className="w-4 h-4 mr-2" /> Cambiar
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1 space-y-1">
                                            <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                                    <SelectValue placeholder="Selecciona cancha" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                                    {courts.map((c, i) => (
                                                        <SelectItem key={i} value={`cancha_${i + 1}`}>{c}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handleSaveCourt} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white h-9">
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        </Button>
                                        <Button variant="ghost" onClick={() => setEditCourtMode(false)} className="h-9 hover:bg-neutral-800">
                                            Cancelar
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Jugadores Add */}
                            <div className="space-y-3 pt-2">
                                <h4 className="font-bold text-sm text-emerald-400 flex items-center gap-2">
                                    <Users className="w-4 h-4" /> Jugadores Inscritos
                                </h4>
                                <div className="flex gap-2">
                                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                        <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white w-full h-10">
                                            <SelectValue placeholder="Buscar jugador..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[150px]">
                                            {allUsers.map((u) => (
                                                <SelectItem key={u.auth_id} value={u.auth_id}>{u.nombre} (Lvl {u.nivel})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleAddPlayerFormal} disabled={saving || !selectedUserId} className="bg-blue-600 hover:bg-blue-500 text-white px-3 h-10">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    </Button>
                                </div>
                                
                                <div className="mt-4 space-y-2">
                                    {jugadores.map((j) => (
                                        <div key={j.id} className="text-sm bg-neutral-900/50 px-3 py-2 rounded flex justify-between items-center border border-neutral-800 group hover:border-neutral-700 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-white">{j.jugador?.[0]?.nombre || "Jugador"}</span>
                                                <span className="text-[10px] text-neutral-500 uppercase">Nivel {j.jugador?.[0]?.nivel || "-"}</span>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleRemovePlayer(j.id)}
                                                className="h-8 w-8 p-0 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {jugadores.length === 0 && (
                                        <div className="text-center py-4 text-xs text-neutral-600 border border-dashed border-neutral-800 rounded-lg">
                                            Sin jugadores inscritos formalmente
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Descripción Manual (Texto) */}
                            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                                <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Etiqueta de Texto (Lugar)</span>
                                <div className="flex gap-2">
                                    <Input 
                                        placeholder="Nombre o nota rápida..." 
                                        value={addedName} 
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddedName(e.target.value)}
                                        className="bg-neutral-900 border-neutral-800 text-white h-9 flex-1"
                                    />
                                    <Button onClick={handleAddPlayerText} disabled={saving || !addedName.trim()} variant="secondary" className="h-9 px-3">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-[10px] text-neutral-400 bg-neutral-900/50 p-2 rounded border border-neutral-800/50 leading-relaxed">
                                    <span className="font-bold text-emerald-500 mr-1">Preview:</span> {partido?.lugar}
                                </p>
                            </div>

                            {/* Zona de Peligro */}
                            <div className="pt-2">
                                <Button onClick={handleDelete} disabled={saving} variant="destructive" className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 py-6">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                    Eliminar Reserva Completa
                                </Button>
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
