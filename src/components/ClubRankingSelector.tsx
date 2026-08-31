"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClubOption {
    id: string;
    nombre: string;
}

export function ClubRankingSelector({ clubes, selectedClubId }: { clubes: ClubOption[]; selectedClubId: string }) {
    const router = useRouter();

    return (
        <Select value={selectedClubId} onValueChange={(v) => router.push(`/ranking?club=${v}`)}>
            <SelectTrigger className="w-full sm:w-[220px] bg-paper border-olive/30 text-ink shadow-md">
                <SelectValue placeholder="Selecciona un club" />
            </SelectTrigger>
            <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                <SelectItem value="global" className="font-bold text-emerald-700">
                    🌎 Ranking Global
                </SelectItem>
                {clubes.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                        {club.nombre}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
