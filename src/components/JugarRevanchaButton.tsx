"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearRevancha } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Repeat } from "lucide-react";

export function JugarRevanchaButton({ matchId }: { matchId: string }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleClick = () => {
        startTransition(async () => {
            const res = await crearRevancha(matchId);
            if (!res.success) {
                alert(res.message || "No se pudo crear la revancha.");
                return;
            }
            router.refresh();
        });
    };

    return (
        <button
            onClick={handleClick}
            disabled={isPending}
            className="text-[10px] font-bold uppercase text-purple-700 bg-purple-700/10 border border-purple-700/30 rounded-full px-2 py-1 hover:bg-purple-700/20 transition-colors disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
        >
            <Repeat className="w-3 h-3" /> {isPending ? "..." : "Revancha"}
        </button>
    );
}
