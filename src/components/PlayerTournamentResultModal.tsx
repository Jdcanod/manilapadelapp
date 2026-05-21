"use client";

import React, { useState, useTransition, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { registrarResultadoPorJugador } from "@/app/(dashboard)/torneos/actions";
import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    matchId: string;
    pareja1Nombre: string;
    pareja2Nombre: string;
    buttonText?: string;
    tipoDesempate?: string;
    disabled?: boolean;
    disabledReason?: string;
    setsCantidad?: number;
}

export function PlayerTournamentResultModal({ matchId, pareja1Nombre, pareja2Nombre, buttonText, initialResult, tipoDesempate = "tercer_set", disabled, disabledReason, setsCantidad = 3 }: Props & { initialResult?: string | null }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    
    // Inicializar sets desde initialResult si existe (formato "6-4, 6-2")
    const getInitialSets = useCallback(() => {
        if (initialResult) {
            try {
                const parsed = initialResult.split(',').map(s => {
                    const parts = s.trim().split('-');
                    return { p1: parts[0] || "", p2: parts[1] || "" };
                });
                if (parsed.length > 0) return parsed;
            } catch {
                // fall through
            }
        }
        return setsCantidad === 1 ? [{ p1: "", p2: "" }] : [{ p1: "", p2: "" }, { p1: "", p2: "" }];
    }, [initialResult, setsCantidad]);

    const [sets, setSets] = useState(getInitialSets);

    useEffect(() => {
        if (open) {
            setSets(getInitialSets());
        }
    }, [open, getInitialSets]);

    const addSet = () => setSets([...sets, { p1: "", p2: "" }]);

    const onSave = () => {
        const potentialSets = sets.filter(s => s.p1.trim() !== "" || s.p2.trim() !== "");
        
        if (setsCantidad === 1) {
            if (potentialSets.length < 1) {
                return alert("Error: Los partidos deben tener al menos 1 set registrado.");
            }
        } else {
            if (potentialSets.length < 2) {
                return alert("Error: Los partidos deben tener al menos 2 sets registrados.");
            }
        }

        let p1Sets = 0;
        let p2Sets = 0;
        const validSets = [];

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
                if (p1 > 9 || p2 > 9) {
                    return alert(`Error en set ${idx + 1}: Formato no válido, juegos superan el límite normal.`);
                }
                
                // Set a 4 juegos
                if (max === 4 && min <= 2) setValido = true;
                else if (max === 5 && (min === 3 || min === 4)) setValido = true;
                // Set a 6 juegos
                else if (max === 6 && min <= 4) setValido = true;
                else if (max === 7 && (min === 5 || min === 6)) setValido = true;
                // Set a 8 juegos
                else if (max === 8 && min <= 7) setValido = true;
                else if (max === 9 && (min === 7 || min === 8)) setValido = true;
            }

            if (!setValido) {
                return alert(`El marcador ${p1}-${p2} en el set ${idx + 1} no es válido para sets de 4, 6 u 8 juegos.`);
            }

            validSets.push({ p1, p2 });
            if (p1 > p2) p1Sets++;
            else p2Sets++;
        }

        const maxSetsWon = Math.max(p1Sets, p2Sets);
        const minSetsWon = Math.min(p1Sets, p2Sets);

        // Validar que haya un ganador claro
        if (maxSetsWon === 0) {
            return alert("Error: Un equipo debe ganar al menos 1 set.");
        }
        if (setsCantidad === 1) {
            if (maxSetsWon > 1) {
                return alert("Error: Ningún equipo puede ganar más de 1 set en este formato.");
            }
        } else {
            if (maxSetsWon === 1 && minSetsWon === 1) {
                return alert("Error: El partido no puede terminar en empate de sets (1-1).");
            }
            if (maxSetsWon > 2) {
                return alert("Error: Ningún equipo puede ganar más de 2 sets.");
            }
            if (maxSetsWon === 2 && minSetsWon === 2) {
                return alert("Error: No puede haber un empate en sets (2-2).");
            }
        }

        const resultadoFinal = validSets.map(s => `${s.p1}-${s.p2}`).join(", ");
        console.log("[PlayerResultModal] Submitting:", { matchId, resultadoFinal });
        setStatusMsg(null);

        startTransition(async () => {
            try {
                const result = await registrarResultadoPorJugador(matchId, resultadoFinal);
                console.log("[PlayerResultModal] Server response:", result);
                if (result.success) {
                    setStatusMsg("¡Resultado guardado! Actualizando tabla...");
                    setTimeout(() => {
                        window.location.href = window.location.pathname + "?refresh=" + Date.now();
                    }, 1500);
                } else {
                    const errorMsg = result.message || "Error al guardar el resultado";
                    setStatusMsg("❌ " + errorMsg);
                    alert(errorMsg);
                }
            } catch (err: unknown) {
                const errorMsg = err instanceof Error ? err.message : "Error desconocido";
                console.error("[PlayerResultModal] exception:", err);
                setStatusMsg("❌ " + errorMsg);
                alert(errorMsg);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button 
                    disabled={disabled}
                    className={cn(
                        `w-full text-white font-black text-[10px] uppercase tracking-widest h-9 py-0 shadow-lg transition-all`,
                        disabled ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" : (buttonText === 'Corregir' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500')
                    )}
                    title={disabledReason}
                >
                    <Swords className="w-3 h-3 mr-2" />
                    {disabled ? (disabledReason || "Esperando programación") : (buttonText || "Subir Resultado")}
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
                                <span className="text-[10px] font-black text-neutral-600 w-8">
                                    {idx === 2 && tipoDesempate === 'super_tiebreak' ? 'STB' : `SET ${idx + 1}`}
                                </span>
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
                        {setsCantidad !== 1 && (
                            <Button variant="outline" onClick={addSet} disabled={sets.length >= 3} className="flex-1 border-neutral-800 bg-transparent hover:bg-neutral-900 text-neutral-400 font-bold text-[10px] uppercase tracking-widest h-10 rounded-xl">
                                + Añadir Set
                            </Button>
                        )}
                        <Button onClick={onSave} disabled={isPending} className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest h-10 rounded-xl">
                            {isPending ? "Enviando..." : "Guardar Resultado"}
                        </Button>
                    </div>

                    {statusMsg && (
                        <div className={`mt-4 text-center text-xs font-bold p-3 rounded-xl animate-in slide-in-from-bottom-2 ${statusMsg.startsWith('✅') ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
                            {statusMsg}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
