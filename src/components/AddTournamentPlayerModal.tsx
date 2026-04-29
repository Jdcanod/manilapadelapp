"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, AlertCircle } from "lucide-react";
import { inscribirParejaManual, obtenerTodosJugadores } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { formatPlayerName, isGuestEmail } from "@/lib/display-names";

interface AddTournamentPlayerModalProps {
    torneoId: string;
    categorias: string[];
    esMaster: boolean;
}

interface User {
    id: string;
    nombre: string;
    apellido?: string | null;
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
    const [j1Manual, setJ1Manual] = useState(false);
    const [j2Manual, setJ2Manual] = useState(false);
    const [j1Name, setJ1Name] = useState("");
    const [j2Name, setJ2Name] = useState("");

    const [categoria, setCategoria] = useState(categorias[0] || "6ta");
    const [error, setError] = useState<string | null>(null);

    // Ordenado alfabéticamente por el nombre formateado para que la búsqueda
    // dentro del select sea predecible.
    const sortedUsers = useMemo(() => {
        return [...allUsers].sort((a, b) => {
            const na = formatPlayerName({ nombre: a.nombre, apellido: a.apellido, email: a.email });
            const nb = formatPlayerName({ nombre: b.nombre, apellido: b.apellido, email: b.email });
            return na.localeCompare(nb);
        });
    }, [allUsers]);

    const checkDisabled = () => {
        if (isPending) return true;
        if (j1Manual && j1Name.trim().length < 2) return true;
        if (!j1Manual && !selectedJ1Id) return true;
        if (j2Manual && j2Name.trim().length < 2) return true;
        if (!j2Manual && !selectedJ2Id) return true;
        return false;
    };

    const handleInscribir = () => {
        const finalJ1 = j1Manual ? `manual:${j1Name.trim()}` : selectedJ1Id;
        const finalJ2 = j2Manual ? `manual:${j2Name.trim()}` : selectedJ2Id;

        if (finalJ1 === finalJ2 && !j1Manual && !j2Manual) {
            setError("Los jugadores deben ser distintos");
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                const result = await inscribirParejaManual(torneoId, finalJ1, finalJ2, categoria, esMaster);
                
                if (result.success) {
                    setOpen(false);
                    setSelectedJ1Id("");
                    setSelectedJ2Id("");
                    setJ1Name("");
                    setJ2Name("");
                    setJ1Manual(false);
                    setJ2Manual(false);
                    router.refresh(); 
                } else {
                    setError(result.error || "Error al inscribir");
                }
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
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-neutral-400">Jugador 1</label>
                            <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                                <input type="checkbox" checked={j1Manual} onChange={(e) => setJ1Manual(e.target.checked)} className="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500" />
                                Añadir invitado (No Registrado)
                            </label>
                        </div>
                        {j1Manual ? (
                            <Input 
                                placeholder="Nombre completo del Jugador 1" 
                                value={j1Name} 
                                onChange={(e) => setJ1Name(e.target.value)} 
                                className="bg-neutral-950 border-neutral-800" 
                            />
                        ) : (
                            <Select value={selectedJ1Id} onValueChange={setSelectedJ1Id}>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Seleccione al primer jugador" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[300px]">
                                    {sortedUsers.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {formatPlayerName({ nombre: u.nombre, apellido: u.apellido, email: u.email })}
                                            {!isGuestEmail(u.email) && (
                                                <span className="text-neutral-500 text-xs ml-2">({u.email})</span>
                                            )}
                                        </SelectItem>
                                    ))}
                                    {sortedUsers.length === 0 && <SelectItem value="disabled" disabled>Cargando jugadores...</SelectItem>}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Jugador 2 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-neutral-400">Jugador 2</label>
                            <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
                                <input type="checkbox" checked={j2Manual} onChange={(e) => setJ2Manual(e.target.checked)} className="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500" />
                                Añadir invitado (No Registrado)
                            </label>
                        </div>
                        {j2Manual ? (
                            <Input 
                                placeholder="Nombre completo del Jugador 2" 
                                value={j2Name} 
                                onChange={(e) => setJ2Name(e.target.value)} 
                                className="bg-neutral-950 border-neutral-800" 
                            />
                        ) : (
                            <Select value={selectedJ2Id} onValueChange={setSelectedJ2Id}>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Seleccione al segundo jugador" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[300px]">
                                    {sortedUsers.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {formatPlayerName({ nombre: u.nombre, apellido: u.apellido, email: u.email })}
                                            {!isGuestEmail(u.email) && (
                                                <span className="text-neutral-500 text-xs ml-2">({u.email})</span>
                                            )}
                                        </SelectItem>
                                    ))}
                                    {sortedUsers.length === 0 && <SelectItem value="disabled" disabled>Cargando jugadores...</SelectItem>}
                                </SelectContent>
                            </Select>
                        )}
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
                        disabled={checkDisabled()}
                        onClick={handleInscribir}
                    >
                        {isPending ? "Inscribiendo..." : "Confirmar Inscripción"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
