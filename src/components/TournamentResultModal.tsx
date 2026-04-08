"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { registrarResultadoTorneo } from "@/app/(dashboard)/torneos/match-actions";
import { Trophy } from "lucide-react";

interface Props {
    matchId: string;
    pareja1Nombre: string;
    pareja2Nombre: string;
    userId: string;
}

export function TournamentResultModal({ matchId, pareja1Nombre, pareja2Nombre, userId }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [sets, setSets] = useState([{ p1: "", p2: "" }]);

    const addSet = () => setSets([...sets, { p1: "", p2: "" }]);

    const onSave = () => {
        const resultadoFinal = sets
            .filter(s => s.p1 !== "" && s.p2 !== "")
            .map(s => `${s.p1}-${s.p2}`)
            .join(", ");

        if (!resultadoFinal) return alert("Ingresa al menos un set");

        startTransition(async () => {
            try {
                await registrarResultadoTorneo(matchId, resultadoFinal, userId);
                setOpen(false);
                alert("Resultado registrado. Pendiente de confirmación del rival.");
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold w-full">
                    <Trophy className="w-4 h-4 mr-2" />
                    Registrar Resultado
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-sm">
                <DialogHeader>
                    <DialogTitle>Resultado del Partido</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4 text-center text-xs font-bold text-neutral-500 uppercase">
                        <span className="line-clamp-1">{pareja1Nombre}</span>
                        <span className="line-clamp-1">{pareja2Nombre}</span>
                    </div>
                    {sets.map((set, idx) => (
                        <div key={idx} className="flex items-center gap-3">
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
                    <Button variant="ghost" size="sm" onClick={addSet} className="text-emerald-500 w-full">+ Añadir Set</Button>
                </div>
                <Button disabled={isPending} onClick={onSave} className="w-full bg-emerald-600 hover:bg-emerald-500">
                    {isPending ? "Guardando..." : "Subir Resultado"}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
