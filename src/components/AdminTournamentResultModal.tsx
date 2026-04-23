"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { registrarResultadoPorClub } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Trophy } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
    matchId: string;
    pareja1Nombre: string;
    pareja2Nombre: string;
    initialResult?: string | null;
    tipoDesempate?: string;
}

export function AdminTournamentResultModal({ matchId, pareja1Nombre, pareja2Nombre, initialResult, tipoDesempate = "tercer_set" }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const getInitialSets = useCallback(() => {
        if (initialResult) {
            try {
                return initialResult.split(',').map(s => {
                    const parts = s.trim().split('-');
                    return { p1: parts[0] || "", p2: parts[1] || "" };
                });
            } catch {
                return [{ p1: "", p2: "" }, { p1: "", p2: "" }];
            }
        }
        return [{ p1: "", p2: "" }, { p1: "", p2: "" }];
    }, [initialResult]);

    const [sets, setSets] = useState(getInitialSets);

    useEffect(() => {
        if (open) {
            setSets(getInitialSets());
        }
    }, [open, getInitialSets]);

    const addSet = () => setSets([...sets, { p1: "", p2: "" }]);

    const onSave = () => {
        const potentialSets = sets.filter(s => s.p1.trim() !== "" || s.p2.trim() !== "");
        
        if (potentialSets.length < 2) return alert("Error: Los partidos deben tener al menos 2 sets registrados.");

        let p1Sets = 0;
        let p2Sets = 0;
        const validSets = [];

        // Validar reglas de Padel para cada set, tratando vacíos como 0
        for (let idx = 0; idx < potentialSets.length; idx++) {
            const set = potentialSets[idx];
            const p1 = parseInt(set.p1 || "0");
            const p2 = parseInt(set.p2 || "0");

            const max = Math.max(p1, p2);
            const min = Math.min(p1, p2);

            let setValido = false;

            if (idx === 2 && tipoDesempate === 'super_tiebreak') {
                if (max < 10) {
                    return alert(`El 3er set es un Super Tie-break. El ganador debe llegar a 10 puntos (Ingresado: ${p1}-${p2}).`);
                }
                if (max - min < 2) {
                    return alert(`En el Super Tie-break debe haber una diferencia de 2 puntos (Ingresado: ${p1}-${p2}).`);
                }
                if (max > 10 && max - min !== 2) {
                    return alert(`El marcador extendido del Super Tie-break es inválido. Si supera los 10 puntos, la diferencia debe ser exactamente 2 (Ej: 12-10).`);
                }
                setValido = true;
            } else {
                if (p1 > 7 || p2 > 7) {
                    return alert(`Error en set ${idx + 1}: Ningún equipo puede tener más de 7 juegos en un set normal.`);
                }
                if (max === 6 && min <= 4) {
                    setValido = true;
                } else if (max === 7 && (min === 5 || min === 6)) {
                    setValido = true;
                }
            }

            if (!setValido) {
                return alert(`El marcador ${p1}-${p2} en el set ${idx + 1} no es válido.`);
            }

            validSets.push({ p1, p2 });
            if (p1 > p2) p1Sets++;
            else p2Sets++;
        }

        // Validar que haya un ganador claro (2 sets ganados por uno de los dos)
        if (p1Sets < 2 && p2Sets < 2) {
            return alert("Error: Un equipo debe ganar al menos 2 sets para terminar el partido.");
        }

        if (p1Sets === 2 && p2Sets === 2) {
            return alert("Error: No puede haber un empate en sets (2-2). El pádel se juega a ganar 2 de 3 sets.");
        }

        if ((p1Sets === 2 && p2Sets > 1) || (p2Sets === 2 && p1Sets > 1)) {
            return alert("Error: El resultado no es coherente. Un equipo debe ganar 2-0 o 2-1 en sets.");
        }

        if (p1Sets > 2 || p2Sets > 2) {
            return alert("Error: Ningún equipo puede ganar más de 2 sets.");
        }

        const resultadoFinal = validSets
            .map(s => `${s.p1}-${s.p2}`)
            .join(", ");

        startTransition(async () => {
            try {
                const result = await registrarResultadoPorClub(matchId, resultadoFinal);
                if (result.success) {
                    setOpen(false);
                    router.refresh();
                } else {
                    alert(result.error || "Error al guardar el resultado");
                }
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-500 text-white font-bold w-full text-xs h-8">
                    <Trophy className="w-3 h-3 mr-2" />
                    Ingresar Score
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-sm">
                <DialogHeader>
                    <DialogTitle>Resultado del Partido (Admin)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-xs text-neutral-400 text-center mb-4">El resultado ingresado será definitivo y marcará el partido como jugado.</p>
                    <div className="grid grid-cols-2 gap-4 text-center text-xs font-bold text-neutral-500 uppercase">
                        <span className="line-clamp-1">{pareja1Nombre}</span>
                        <span className="line-clamp-1">{pareja2Nombre}</span>
                    </div>
                    {sets.map((set, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-neutral-600 w-12 shrink-0">
                                {idx === 2 && tipoDesempate === 'super_tiebreak' ? 'STB' : `SET ${idx + 1}`}
                            </span>
                            <Input 
                                placeholder="0" 
                                type="number"
                                className="bg-neutral-950 border-neutral-800 text-center text-xl font-black h-12"
                                value={set.p1}
                                onChange={e => {
                                    const newSets = [...sets];
                                    newSets[idx].p1 = e.target.value;
                                    setSets(newSets);
                                }}
                            />
                            <span className="text-neutral-600">-</span>
                            <Input 
                                placeholder="0" 
                                type="number"
                                className="bg-neutral-950 border-neutral-800 text-center text-xl font-black h-12"
                                value={set.p2}
                                onChange={e => {
                                    const newSets = [...sets];
                                    newSets[idx].p2 = e.target.value;
                                    setSets(newSets);
                                }}
                            />
                        </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={addSet} className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 w-full">+ Añadir Set</Button>
                </div>
                <Button disabled={isPending} onClick={onSave} className="w-full bg-amber-600 hover:bg-amber-500">
                    {isPending ? "Guardando..." : "Subir Score Definitivo"}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
