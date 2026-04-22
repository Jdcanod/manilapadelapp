"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { confirmarResultado } from "@/app/(dashboard)/torneos/actions";
import { useRouter } from "next/navigation";

interface Props {
    matchId: string;
}

export function AdminConfirmResultButton({ matchId }: Props) {
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
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase h-8 rounded-lg transition-colors disabled:opacity-50"
        >
            {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
                <>
                    <Check className="w-3 h-3" />
                    Confirmar como Club
                </>
            )}
        </button>
    );
}
