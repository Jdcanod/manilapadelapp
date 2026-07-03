"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { updateMatchTeams } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Settings, Save } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface Pair {
    id?: string;
    nombre_pareja: string | null;
}

interface Props {
    matchId: string;
    currentPareja1Id?: string | null;
    currentPareja2Id?: string | null;
    allPairs: Pair[];
}

export function AdminEditBracketModal({ matchId, currentPareja1Id, currentPareja2Id, allPairs }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();
    const { id: torneoId } = useParams();

    const [p1Id, setP1Id] = useState(currentPareja1Id || "");
    const [p2Id, setP2Id] = useState(currentPareja2Id || "");

    const onSave = () => {
        startTransition(async () => {
            try {
                const res = await updateMatchTeams(matchId, p1Id || null, p2Id || null, torneoId as string);
                if (res.success) {
                    toast({ title: "Guardado", description: "Llave actualizada correctamente." });
                    setOpen(false);
                    router.refresh();
                } else {
                    toast({ title: "Error", description: res.message, variant: "destructive" });
                }
            } catch (err: unknown) {
                toast({ title: "Error", description: (err as Error).message || "No se pudo actualizar", variant: "destructive" });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="absolute -top-2 -right-2 bg-paper-dark hover:bg-paper-dark text-olive hover:text-ink p-1.5 rounded-full shadow-lg border border-olive/30 z-50 transition-colors">
                    <Settings className="w-3.5 h-3.5" />
                </button>
            </DialogTrigger>
            <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black italic text-olive uppercase tracking-widest">Modificar Llave</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-olive uppercase tracking-widest">Pareja 1</label>
                        <select 
                            value={p1Id} 
                            onChange={e => setP1Id(e.target.value)}
                            className="w-full bg-paper border border-olive/20 rounded-xl px-4 py-3 text-sm font-bold text-ink focus:outline-none focus:border-olive transition-colors"
                        >
                            <option value="">-- TBD (Vacio) --</option>
                            {allPairs.map((p, idx) => (
                                p.id && <option key={`p1-${p.id}-${idx}`} value={p.id}>{p.nombre_pareja}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-olive uppercase tracking-widest">Pareja 2</label>
                        <select 
                            value={p2Id} 
                            onChange={e => setP2Id(e.target.value)}
                            className="w-full bg-paper border border-olive/20 rounded-xl px-4 py-3 text-sm font-bold text-ink focus:outline-none focus:border-olive transition-colors"
                        >
                            <option value="">-- TBD (Vacio) --</option>
                            {allPairs.map((p, idx) => (
                                p.id && <option key={`p2-${p.id}-${idx}`} value={p.id}>{p.nombre_pareja}</option>
                            ))}
                        </select>
                    </div>

                </div>
                <Button disabled={isPending} onClick={onSave} className="w-full bg-olive hover:bg-olive text-paper font-black uppercase tracking-widest">
                    {isPending ? "Guardando..." : <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</>}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
