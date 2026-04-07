"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Trash2, Edit, Save, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
    reservationId: string | number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courts: string[]; // e.g. ["Cancha 1", "Cancha 2"]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function GestionReservaModal({ reservationId, open, onOpenChange, courts }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [partido, setPartido] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [jugadores, setJugadores] = useState<any[]>([]);

    const [editCourtMode, setEditCourtMode] = useState(false);
    const [selectedCourt, setSelectedCourt] = useState("");
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
                    
                    // Extraer cancha actual del string "Cancha X (..."
                    const match = pData.lugar.match(/Cancha (\d+)/i);
                    if (match) {
                        setSelectedCourt(match[0]); // "Cancha 1"
                    }
                }
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
        setSaving(true);
        
        // Reemplazar la cancha antigua por la nueva en el string "lugar"
        const currentLugar = partido.lugar;
        const newLugar = currentLugar.replace(/Cancha \d+/i, selectedCourt);
        
        const { error } = await supabase.from('partidos').update({ lugar: newLugar }).eq('id', reservationId);
        
        setSaving(false);
        if (error) {
            alert("Error al cambiar la cancha: " + error.message);
        } else {
            setPartido({ ...partido, lugar: newLugar });
            setEditCourtMode(false);
            router.refresh();
        }
    };

    const handleAddPlayerText = async () => {
        if (!addedName.trim()) return;
        setSaving(true);
        
        const currentLugar = partido.lugar;
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
            setPartido({ ...partido, lugar: newLugar });
            setAddedName("");
            router.refresh();
        }
    };

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-neutral-900 border-neutral-800 text-neutral-100">
                <DialogHeader>
                    <DialogTitle className="text-xl">Gestión de Reserva</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Visualiza los detalles, asigna una nueva cancha, añade jugadores texto o elimina la reserva.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : !partido ? (
                    <div className="text-red-500 p-4">No se pudo cargar la reserva. Es posible que haya sido eliminada.</div>
                ) : (
                    <div className="space-y-6 pt-2">
                        {/* Info Básica */}
                        <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Fecha/Hora:</span>
                                <span className="font-bold">{new Date(partido.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-neutral-500">Tipo:</span>
                                <span className="font-bold uppercase text-amber-500">{partido.tipo_partido?.replace('_', ' ')}</span>
                            </div>
                            <div className="flex flex-col pt-2 border-t border-neutral-800 mt-2">
                                <span className="text-neutral-500 mb-1">Descripción / Ubicación (Lugar Oficial):</span>
                                <span className="font-medium bg-neutral-900 p-2 rounded">{partido.lugar}</span>
                            </div>
                        </div>

                        {/* Cambio de Cancha */}
                        <div className="space-y-3">
                            <h4 className="font-bold text-sm text-emerald-400">Modificar Cancha Asignada</h4>
                            {!editCourtMode ? (
                                <div className="flex items-center justify-between bg-neutral-950 px-4 py-2 rounded-lg border border-neutral-800">
                                    <span className="font-bold">{selectedCourt || "No detectada"}</span>
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
                                                    <SelectItem key={i} value={`Cancha ${i + 1}`}>Cancha {i + 1}</SelectItem>
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
                            <h4 className="font-bold text-sm text-emerald-400">Añadir personas a la reserva (Etiqueta Textual)</h4>
                            <div className="flex gap-2">
                                <Input 
                                    className="bg-neutral-950 border-neutral-800 [color-scheme:dark]" 
                                    placeholder="Nombre del jugador a agregar..." 
                                    value={addedName}
                                    onChange={(e) => setAddedName(e.target.value)}
                                    maxLength={40}
                                />
                                <Button onClick={handleAddPlayerText} disabled={saving || !addedName.trim()} className="bg-blue-600 hover:bg-blue-500 text-white px-3">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                </Button>
                            </div>
                            
                            {jugadores.length > 0 && (
                                <div className="mt-4">
                                    <h5 className="text-xs text-neutral-500 mb-2">Jugadores Oficiales de la App (Amistoso/Torneo):</h5>
                                    <ul className="space-y-1">
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {jugadores.map((j: any) => (
                                            <li key={j.id} className="text-sm bg-neutral-900 px-3 py-1.5 rounded flex justify-between border border-neutral-800">
                                                <span>{j.jugador?.nombre}</span>
                                                <span className="text-xs text-neutral-500">Lvl {j.jugador?.nivel}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Zona de Peligro */}
                        <div className="pt-6 border-t border-neutral-800 flex justify-end">
                            <Button onClick={handleDelete} disabled={saving} variant="destructive" className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Eliminar Reserva Completa
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
