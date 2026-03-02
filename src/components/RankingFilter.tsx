"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RankingFilter({ clubes }: { clubes: { auth_id: string; nombre: string }[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentCity = searchParams.get("ciudad") || "todas";
    const currentClub = searchParams.get("club") || "todos";

    const updateFilter = (key: string, val: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (val === "todas" || val === "todos") {
            params.delete(key);
        } else {
            params.set(key, val);
        }
        router.push(`/ranking?${params.toString()}`);
    };

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            <Select value={currentCity} onValueChange={(v) => updateFilter("ciudad", v)}>
                <SelectTrigger className="w-full sm:w-[150px] bg-neutral-950 border-neutral-700 text-neutral-100 shadow-md">
                    <SelectValue placeholder="Ciudad" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="todas">Todas las ciudades</SelectItem>
                    <SelectItem value="manizales">Manizales</SelectItem>
                    <SelectItem value="pereira">Pereira</SelectItem>
                    <SelectItem value="bogota">Bogotá</SelectItem>
                </SelectContent>
            </Select>

            <Select value={currentClub} onValueChange={(v) => updateFilter("club", v)}>
                <SelectTrigger className="w-full sm:w-[180px] bg-neutral-950 border-neutral-700 text-neutral-100 shadow-md">
                    <SelectValue placeholder="Club" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="todos">Todos los clubes</SelectItem>
                    {clubes.map((club) => (
                        <SelectItem key={club.auth_id} value={club.auth_id}>
                            {club.nombre}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
