"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { darDeBajaPareja, actualizarEstadoPago, editarParticipantesInscripcion, obtenerTodosJugadores } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Edit2, CreditCard, UserPlus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
    id: string;
    nombre: string;
    email: string;
}

interface AdminParticipantActionsProps {
    id: string;
    parejaId: string;
    tipo: 'master' | 'regular';
    torneoId: string;
    hasStarted: boolean;
    j1Id?: string;
    j2Id?: string;
    estadoPago?: string;
}

export function AdminParticipantActions({ id, parejaId, tipo, torneoId, hasStarted, j1Id, j2Id, estadoPago }: AdminParticipantActionsProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [editOpen, setEditOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // Estado para edición
    const [selectedJ1, setSelectedJ1] = useState(j1Id || "");
    const [selectedJ2, setSelectedJ2] = useState(j2Id || "");
    const [j1Manual, setJ1Manual] = useState(false);
    const [j2Manual, setJ2Manual] = useState(false);
    const [j1Name, setJ1Name] = useState("");
    const [j2Name, setJ2Name] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (editOpen && allUsers.length === 0) {
            obtenerTodosJugadores().then(setAllUsers);
        }
    }, [editOpen, allUsers.length]);

    const handleTogglePago = () => {
        const nuevoEstado = estadoPago === 'pagado' ? 'pendiente' : 'pagado';
        startTransition(async () => {
            try {
                await actualizarEstadoPago(id, tipo, nuevoEstado, torneoId);
                router.refresh();
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al cambiar estado de pago");
            }
        });
    };

    const handleEditParticipants = () => {
        const finalJ1 = j1Manual ? `manual:${j1Name.trim()}` : selectedJ1;
        const finalJ2 = j2Manual ? `manual:${j2Name.trim()}` : selectedJ2;

        if (!finalJ1 || !finalJ2) {
            setError("Debes seleccionar ambos jugadores");
            return;
        }
        if (finalJ1 === finalJ2 && !j1Manual && !j2Manual) {
            setError("Los jugadores deben ser distintos");
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                const res = await editarParticipantesInscripcion(id, tipo, parejaId, finalJ1, finalJ2, torneoId);
                if (res.success) {
                    setEditOpen(false);
                    router.refresh();
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error al editar integrantes");
            }
        });
    };

    const handleEliminar = () => {
        const msg = hasStarted 
            ? "El torneo ya inició. Al dar de baja a esta pareja, se ELIMINARÁN todos sus partidos PENDIENTES. Los partidos ya jugados se mantendrán. ¿Deseas continuar?"
            : "¿Seguro que deseas eliminar esta inscripción del torneo?";
            
        if (!confirm(msg)) return;
        
        startTransition(async () => {
            try {
                await darDeBajaPareja(id, tipo, parejaId, torneoId);
                router.refresh();
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al eliminar");
            }
        });
    };

    return (
        <div className="flex gap-2 justify-end items-center">
            {/* BOTÓN PAGO */}
            <Button
                variant="ghost"
                size="sm"
                onClick={handleTogglePago}
                disabled={isPending}
                className={cn(
                    "h-8 px-2 text-[10px] font-black uppercase tracking-widest gap-1.5 rounded-lg border transition-all",
                    estadoPago === 'pagado' 
                        ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10" 
                        : "text-amber-500 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
                )}
            >
                <CreditCard className="w-3 h-3" />
                {estadoPago === 'pagado' ? "Pagado" : "Pendiente"}
            </Button>

            {/* MODAL EDITAR JUGADORES */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg"
                    >
                        <Edit2 className="w-3 h-3" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="bg-neutral-950 border-neutral-900 text-white max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black italic uppercase tracking-widest text-amber-500 flex items-center gap-2">
                            <UserPlus className="w-5 h-5" /> Editar Integrantes
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest leading-relaxed">
                                Nota: Esto actualizará los nombres en todos los partidos (grupos y eliminatorias) donde participa esta pareja sin alterar el cronograma.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {/* Jugador 1 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Jugador 1</label>
                                    <label className="flex items-center gap-2 text-[10px] text-neutral-500 cursor-pointer hover:text-amber-500 transition-colors">
                                        <input type="checkbox" checked={j1Manual} onChange={(e) => setJ1Manual(e.target.checked)} className="rounded border-neutral-800 bg-neutral-900 text-amber-500 focus:ring-amber-500" />
                                        Invitado
                                    </label>
                                </div>
                                {j1Manual ? (
                                    <Input 
                                        placeholder="Nombre completo" 
                                        value={j1Name} 
                                        onChange={(e) => setJ1Name(e.target.value)} 
                                        className="bg-neutral-900 border-neutral-800 h-12 rounded-xl"
                                    />
                                ) : (
                                    <Select value={selectedJ1} onValueChange={setSelectedJ1}>
                                        <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12 rounded-xl">
                                            <SelectValue placeholder="Seleccionar jugador" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[300px]">
                                            {allUsers.map(u => (
                                                <SelectItem key={u.id} value={u.id} className="focus:bg-amber-500/10 focus:text-amber-500">
                                                    {u.nombre} <span className="text-[10px] text-neutral-500 ml-2 italic">{u.email}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Jugador 2 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Jugador 2</label>
                                    <label className="flex items-center gap-2 text-[10px] text-neutral-500 cursor-pointer hover:text-amber-500 transition-colors">
                                        <input type="checkbox" checked={j2Manual} onChange={(e) => setJ2Manual(e.target.checked)} className="rounded border-neutral-800 bg-neutral-900 text-amber-500 focus:ring-amber-500" />
                                        Invitado
                                    </label>
                                </div>
                                {j2Manual ? (
                                    <Input 
                                        placeholder="Nombre completo" 
                                        value={j2Name} 
                                        onChange={(e) => setJ2Name(e.target.value)} 
                                        className="bg-neutral-900 border-neutral-800 h-12 rounded-xl"
                                    />
                                ) : (
                                    <Select value={selectedJ2} onValueChange={setSelectedJ2}>
                                        <SelectTrigger className="bg-neutral-900 border-neutral-800 h-12 rounded-xl">
                                            <SelectValue placeholder="Seleccionar jugador" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[300px]">
                                            {allUsers.map(u => (
                                                <SelectItem key={u.id} value={u.id} className="focus:bg-amber-500/10 focus:text-amber-500">
                                                    {u.nombre} <span className="text-[10px] text-neutral-500 ml-2 italic">{u.email}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-red-500 text-xs font-bold">{error}</span>
                            </div>
                        )}

                        <Button 
                            className="w-full bg-amber-600 hover:bg-amber-500 h-12 rounded-xl font-black uppercase tracking-widest text-xs" 
                            onClick={handleEditParticipants}
                            disabled={isPending}
                        >
                            {isPending ? "Guardando..." : "Confirmar Cambios"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* BOTÓN ELIMINAR */}
            <Button
                variant="ghost"
                size="sm"
                onClick={handleEliminar}
                disabled={isPending}
                className="h-8 w-8 p-0 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
                <Trash2 className="w-3 h-3" />
            </Button>
        </div>
    );
}
