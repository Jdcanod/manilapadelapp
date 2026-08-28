"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Gauge, Save, Loader2, CheckCircle2 } from "lucide-react";
import { actualizarBonoNivelConfig } from "@/app/(dashboard)/club/torneos/[id]/actions";

interface BonoConfig {
    activo: boolean;
    campeon: number;
    subcampeon: number;
    tercer_puesto: number;
    participacion: number;
}

const DEFAULT_CONFIG: BonoConfig = { activo: false, campeon: 0.15, subcampeon: 0.08, tercer_puesto: 0.04, participacion: 0 };

export function BonoNivelConfigControl({ torneoId, config }: { torneoId: string; config: BonoConfig | null }) {
    const router = useRouter();
    const [local, setLocal] = useState<BonoConfig>(config || DEFAULT_CONFIG);
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => {
        setError(null);
        startTransition(async () => {
            const res = await actualizarBonoNivelConfig(torneoId, local);
            if (!res.success) {
                setError(res.error || "Error al guardar");
                return;
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            router.refresh();
        });
    };

    const fields = [
        { key: 'campeon' as const, label: 'Campeón', emoji: '🏆' },
        { key: 'subcampeon' as const, label: 'Subcampeón', emoji: '🥈' },
        { key: 'tercer_puesto' as const, label: '3er Puesto', emoji: '🥉' },
        { key: 'participacion' as const, label: 'Resto (participación)', emoji: '⭐' },
    ];

    return (
        <div className="bg-paper-soft border border-olive/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-ink">Bono de Nivel por Posición</h3>
            </div>
            <div className="flex items-start gap-3">
                <Checkbox
                    id="bono-nivel-activo-edit"
                    checked={local.activo}
                    onCheckedChange={(v) => setLocal(prev => ({ ...prev, activo: !!v }))}
                    className="mt-0.5 border-olive/30 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-black"
                />
                <Label htmlFor="bono-nivel-activo-edit" className="text-sm font-semibold text-ink cursor-pointer">
                    Dar bono de nivel al terminar cada categoría de este torneo
                </Label>
            </div>

            {local.activo && (
                <div className="space-y-2 pt-1">
                    {fields.map(({ key, label, emoji }) => (
                        <div key={key} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                            <span className="text-sm font-bold text-ink">{emoji} {label}</span>
                            <Input
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={local[key]}
                                onChange={e => setLocal(prev => ({ ...prev, [key]: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                                className="w-20 h-8 bg-paper border-olive/20 text-ink text-center text-sm"
                            />
                        </div>
                    ))}
                </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            <Button
                onClick={handleSave}
                disabled={isPending}
                size="sm"
                className={saved ? "bg-emerald-700 hover:bg-emerald-700 text-ink" : "bg-olive hover:bg-olive text-paper"}
            >
                {isPending
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Guardando...</>
                    : saved
                        ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> ¡Guardado!</>
                        : <><Save className="w-3.5 h-3.5 mr-1.5" /> Guardar</>
                }
            </Button>
        </div>
    );
}
