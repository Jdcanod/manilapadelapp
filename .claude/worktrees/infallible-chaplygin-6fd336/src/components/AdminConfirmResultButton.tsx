"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { confirmarResultado } from "@/app/(dashboard)/torneos/actions";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
    matchId: string;
    compact?: boolean;
}

export function AdminConfirmResultButton({ matchId, compact }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleConfirm = async () => {
        if (!confirm("¿Deseas confirmar este resultado como oficial?")) return;
        
        startTransition(async () => {
            const res = await confirmarResultado(matchId);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.message);
            }
        });
    };

    return (
        <button
            onClick={handleConfirm}
            disabled={isPending}
            title="Confirmar Resultado como Club"
            className={cn(
                "flex items-center justify-center transition-colors disabled:opacity-50 font-black uppercase",
                compact 
                    ? "w-8 h-8 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-lg"
                    : "w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] h-8 rounded-lg"
            )}
        >
            {isPending ? (
                <Loader2 className={compact ? "w-4 h-4 animate-spin" : "w-3 h-3 animate-spin"} />
            ) : (
                <>
                    <Check className={compact ? "w-4 h-4" : "w-3 h-3"} />
                    {!compact && "Confirmar como Club"}
                </>
            )}
        </button>
    );
}
