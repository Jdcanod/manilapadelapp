"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Search, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buscarCompaneros } from "@/app/(dashboard)/torneos/actions";
import { inscribirParejaManual } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Badge } from "@/components/ui/badge";
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

    const [j1Search, setJ1Search] = useState("");
    const [j2Search, setJ2Search] = useState("");

    const [j1Results, setJ1Results] = useState<User[]>([]);
    const [j2Results, setJ2Results] = useState<User[]>([]);

    const [selectedJ1, setSelectedJ1] = useState<User | null>(null);
    const [selectedJ2, setSelectedJ2] = useState<User | null>(null);
    const [categoria, setCategoria] = useState(categorias[0] || "6ta");
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (query: string, setResults: (val: User[]) => void) => {
        if (query.length >= 3) {
            const results = await buscarCompaneros(query);
            setResults(results);
        } else {
            setResults([]);
        }
    };

    const handleInscribir = () => {
        if (!selectedJ1 || !selectedJ2) {
            setError("Debe seleccionar dos jugadores");
            return;
        }

        if (selectedJ1.id === selectedJ2.id) {
            setError("Los jugadores deben ser distintos");
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                await inscribirParejaManual(torneoId, selectedJ1.id, selectedJ2.id, categoria, esMaster);
                setOpen(false);
                setSelectedJ1(null);
                setSelectedJ2(null);
                setJ1Search("");
                setJ2Search("");
                router.refresh(); // Asegurar que la UI se actualiza con la nueva pareja
            } catch (err: any) {
                setError(err.message || "Error al inscribir");
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
                        {selectedJ1 ? (
                            <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
                                <div>
                                    <p className="font-bold">{selectedJ1.nombre}</p>
                                    <p className="text-xs text-neutral-500">{selectedJ1.email}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedJ1(null)} className="text-red-400 hover:text-red-300">
                                    Quitar
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                                <Input
                                    placeholder="Buscar por nombre..."
                                    className="pl-9 bg-neutral-950 border-neutral-800"
                                    value={j1Search}
                                    onChange={(e) => {
                                        setJ1Search(e.target.value);
                                        handleSearch(e.target.value, setJ1Results);
                                    }}
                                />
                                {j1Results.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg">
                                        {j1Results.map((u) => (
                                            <div 
                                                key={u.id} 
                                                className="p-2 hover:bg-neutral-700 cursor-pointer flex flex-col"
                                                onClick={() => { setSelectedJ1(u); setJ1Results([]); setJ1Search(""); }}
                                            >
                                                <span className="font-medium text-sm">{u.nombre}</span>
                                                <span className="text-xs text-neutral-400">{u.email}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Jugador 2 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-400">Jugador 2</label>
                        {selectedJ2 ? (
                            <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
                                <div>
                                    <p className="font-bold">{selectedJ2.nombre}</p>
                                    <p className="text-xs text-neutral-500">{selectedJ2.email}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedJ2(null)} className="text-red-400 hover:text-red-300">
                                    Quitar
                                </Button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                                <Input
                                    placeholder="Buscar por nombre..."
                                    className="pl-9 bg-neutral-950 border-neutral-800"
                                    value={j2Search}
                                    onChange={(e) => {
                                        setJ2Search(e.target.value);
                                        handleSearch(e.target.value, setJ2Results);
                                    }}
                                />
                                {j2Results.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg">
                                        {j2Results.map((u) => (
                                            <div 
                                                key={u.id} 
                                                className="p-2 hover:bg-neutral-700 cursor-pointer flex flex-col"
                                                onClick={() => { setSelectedJ2(u); setJ2Results([]); setJ2Search(""); }}
                                            >
                                                <span className="font-medium text-sm">{u.nombre}</span>
                                                <span className="text-xs text-neutral-400">{u.email}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                        disabled={!selectedJ1 || !selectedJ2 || isPending}
                        onClick={handleInscribir}
                    >
                        {isPending ? "Inscribiendo..." : "Confirmar Inscripción"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
