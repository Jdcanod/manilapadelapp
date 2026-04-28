"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, Loader2 } from "lucide-react";
import { confirmarResultado, reiniciarResultado } from "@/app/(dashboard)/torneos/actions";
import { useRouter } from "next/navigation";

export function ConfirmarResultadoButton({ matchId }: { matchId: string }) {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handle = () => {
        setError(null);
        startTransition(async () => {
            const res = await confirmarResultado(matchId);
            if (!res.success) {
                setError(res.message || 'Error');
                return;
            }
            router.refresh();
        });
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <Button
                onClick={handle}
                disabled={pending}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 px-3"
            >
                {pending
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> ...</>
                    : <><Check className="w-3.5 h-3.5 mr-1" /> Confirmar</>
                }
            </Button>
            {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>
    );
}

export function ReiniciarResultadoButton({ matchId }: { matchId: string }) {
    const [pending, startTransition] = useTransition();
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handle = () => {
        if (!confirming) {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 4000);
            return;
        }
        setError(null);
        startTransition(async () => {
            const res = await reiniciarResultado(matchId);
            if (!res.success) {
                setError(res.message || 'Error');
                setConfirming(false);
                return;
            }
            setConfirming(false);
            router.refresh();
        });
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <Button
                onClick={handle}
                disabled={pending}
                size="sm"
                variant="outline"
                className={
                    confirming
                        ? "h-8 px-3 border-red-500/40 text-red-400 hover:bg-red-500/10"
                        : "h-8 px-3 border-neutral-700 text-neutral-400 hover:bg-neutral-800"
                }
            >
                {pending
                    ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> ...</>
                    : confirming
                        ? <>¿Seguro?</>
                        : <><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reiniciar</>
                }
            </Button>
            {error && <span className="text-[10px] text-red-400">{error}</span>}
        </div>
    );
}
