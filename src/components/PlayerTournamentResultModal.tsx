"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { registrarResultadoPorJugador } from "@/app/(dashboard)/torneos/actions";
import { Swords } from "lucide-react";

interface Props {
    matchId: string;
    pareja1Nombre: string;
    pareja2Nombre: string;
    torneoId: string;
    buttonText?: string;
}

export function PlayerTournamentResultModal({ matchId, pareja1Nombre, pareja2Nombre, torneoId, buttonText, initialResult }: Props & { initialResult?: string | null }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    
    // Inicializar sets desde initialResult si existe (formato "6-4, 6-2")
    const getInitialSets = () => {
        if (initialResult) {
            try {
                return initialResult.split(',').map(s => {
                    const parts = s.trim().split('-');
                    return { p1: parts[0] || "", p2: parts[1] || "" };
                });
            } catch (e) {
                return [{ p1: "", p2: "" }, { p1: "", p2: "" }];
            }
        }
        return [{ p1: "", p2: "" }, { p1: "", p2: "" }];
    };

    const [sets, setSets] = useState(getInitialSets);

    useEffect(() => {
        setSets(getInitialSets());
    }, [initialResult]);

    const addSet = () => setSets([...sets, { p1: "", p2: "" }]);

    const onSave = () => {
        const potentialSets = sets.filter(s => s.p1.trim() !== "" || s.p2.trim() !== "");
        
        if (potentialSets.length < 2) {
            return alert("Error: Los partidos deben tener al menos 2 sets registrados.");
        }

        const validSets = [];

        for (const set of potentialSets) {
            const p1 = parseInt(set.p1 || "0");
            const p2 = parseInt(set.p2 || "0");

            if (p1 > 7 || p2 > 7) {
                return alert("Error: Ningún equipo puede tener más de 7 puntos en un set.");
            }

            const max = Math.max(p1, p2);
            const min = Math.min(p1, p2);

            if (max === 6 && min <= 4) {
                validSets.push({ p1, p2 });
                continue;
            }
            if (max === 7 && (min === 5 || min === 6)) {
                validSets.push({ p1, p2 });
                continue;
            }

            return alert(`El marcador ${p1}-${p2} no es válido. Un set debe terminar 6-0 a 6-4, 7-5 o 7-6.`);
        }

        const resultadoFinal = validSets.map(s => `${s.p1}-${s.p2}`).join(", ");

        startTransition(async () => {
            try {
                const result = await registrarResultadoPorJugador(matchId, resultadoFinal);
                if (result.success) {
                    setOpen(false);
                    window.location.reload();
                } else {
                    alert(result.message || "Error al guardar el resultado");
                }
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={`w-full ${buttonText === 'Corregir' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white font-black text-[10px] uppercase tracking-widest h-9 py-0 shadow-lg`}>
                    <Swords className="w-3 h-3 mr-2" />
                    {buttonText || "Subir Resultado"}
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-sm rounded-3xl p-6">
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-xl font-black italic uppercase tracking-tighter text-emerald-500">Registrar Score</DialogTitle>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Sube el resultado final de tu partido</p>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4 text-center">
                        <span className="text-xs font-black text-white uppercase truncate">{pareja1Nombre}</span>
                        <span className="text-[10px] font-black text-neutral-700 italic">VS</span>
                        <span className="text-xs font-black text-white uppercase truncate">{pareja2Nombre}</span>
                    </div>

                    <div className="space-y-3">
                        {sets.map((set, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-neutral-900/50 p-3 rounded-2xl border border-neutral-800/50">
                                <span className="text-[10px] font-black text-neutral-600 w-8">SET {idx + 1}</span>
                                <Input 
                                    placeholder="0" 
                                    type="number" 
                                    value={set.p1}
                                    onChange={(e) => {
                                        const newSets = [...sets];
                                        newSets[idx].p1 = e.target.value;
                                        setSets(newSets);
                                    }}
                                    className="bg-neutral-950 border-neutral-800 text-center font-black text-xl h-12 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                                />
                                <div className="h-[2px] w-4 bg-neutral-800" />
                                <Input 
                                    placeholder="0" 
                                    type="number" 
                                    value={set.p2}
                                    onChange={(e) => {
                                        const newSets = [...sets];
                                        newSets[idx].p2 = e.target.value;
                                        setSets(newSets);
                                    }}
                                    className="bg-neutral-950 border-neutral-800 text-center font-black text-xl h-12 rounded-xl focus:ring-emerald-500 focus:border-emerald-500"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={addSet} disabled={sets.length >= 3} className="flex-1 border-neutral-800 bg-transparent hover:bg-neutral-900 text-neutral-400 font-bold text-[10px] uppercase tracking-widest h-10 rounded-xl">
                            + Añadir Set
                        </Button>
                        <Button onClick={onSave} disabled={isPending} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest h-10 rounded-xl">
                            {isPending ? "Enviando..." : "Guardar Resultado"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
