"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, AlertCircle } from "lucide-react";
import { inscribirParejaManual, obtenerTodosJugadores } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { useRouter } from "next/navigation";

interface AddTournamentPlayerModalProps {
    torneoId: string;
    categorias: string[];
    esMaster: boolean;
}

interface User {
    id: string;
    nombre: string;
    email: string;
}

export function AddTournamentPlayerModal({ torneoId, categorias, esMaster }: AddTournamentPlayerModalProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // Cargar todos los jugadores al montar
    useEffect(() => {
        obtenerTodosJugadores().then(setAllUsers);
    }, []);

    const [selectedJ1Id, setSelectedJ1Id] = useState<string>("");
    const [selectedJ2Id, setSelectedJ2Id] = useState<string>("");
    const [categoria, setCategoria] = useState(categorias[0] || "6ta");
    const [error, setError] = useState<string | null>(null);

    const handleInscribir = () => {
        if (!selectedJ1Id || !selectedJ2Id) {
            setError("Debe seleccionar dos jugadores");
            return;
        }

        if (selectedJ1Id === selectedJ2Id) {
            setError("Los jugadores deben ser distintos");
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                await inscribirParejaManual(torneoId, selectedJ1Id, selectedJ2Id, categoria, esMaster);
                setOpen(false);
                setSelectedJ1Id("");
                setSelectedJ2Id("");
                router.refresh(); 
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error al inscribir");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-500 text-white font-bold h-10 px-4">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Inscripción Manual
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl">Inscribir Pareja Manualmente</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-4">
                    {/* Jugador 1 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">Jugador 1</label>
                        <Select value={selectedJ1Id} onValueChange={setSelectedJ1Id}>
                            <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                <SelectValue placeholder="Seleccione al primer jugador" />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[300px]">
                                {allUsers.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.nombre} <span className="text-neutral-500 text-xs ml-2">({u.email})</span>
                                    </SelectItem>
                                ))}
                                {allUsers.length === 0 && <SelectItem value="disabled" disabled>Cargando jugadores...</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Jugador 2 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">Jugador 2</label>
                        <Select value={selectedJ2Id} onValueChange={setSelectedJ2Id}>
                            <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                <SelectValue placeholder="Seleccione al segundo jugador" />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[300px]">
                                {allUsers.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>
                                        {u.nombre} <span className="text-neutral-500 text-xs ml-2">({u.email})</span>
                                    </SelectItem>
                                ))}
                                {allUsers.length === 0 && <SelectItem value="disabled" disabled>Cargando jugadores...</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Categoría */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">Categoría</label>
                        <Select value={categoria} onValueChange={setCategoria}>
                            <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                {categorias.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                                {categorias.length === 0 && (
                                    <>
                                        <SelectItem value="6ta">6ta Categoría</SelectItem>
                                        <SelectItem value="5ta">5ta Categoría</SelectItem>
                                        <SelectItem value="4ta">4ta Categoría</SelectItem>
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            <span className="text-red-500 text-sm">{error}</span>
                        </div>
                    )}

                    <Button 
                        className="w-full bg-amber-600 hover:bg-amber-500" 
                        disabled={!selectedJ1Id || !selectedJ2Id || isPending}
                        onClick={handleInscribir}
                    >
                        {isPending ? "Inscribiendo..." : "Confirmar Inscripción"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
