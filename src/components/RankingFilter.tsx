"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RankingFilter({ currentCategory }: { currentCategory: string }) {
    const router = useRouter();

    const handleCategoryChange = (val: string) => {
        router.push(`/ranking?categoria=${val}`);
    };

    return (
        <Select value={currentCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-[180px] bg-neutral-950 border-neutral-700 text-neutral-100 shadow-md">
                <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                <SelectItem value="todas">Todas las categorías</SelectItem>
                <SelectItem value="1ra">1ra Categoría</SelectItem>
                <SelectItem value="2da">2da Categoría</SelectItem>
                <SelectItem value="3ra">3ra Categoría</SelectItem>
                <SelectItem value="4ta">4ta Categoría</SelectItem>
                <SelectItem value="5ta">5ta Categoría</SelectItem>
                <SelectItem value="6ta">6ta Categoría</SelectItem>
                <SelectItem value="7ma">7ma Categoría</SelectItem>
                <SelectItem value="damas 6ta">Damas 6ta</SelectItem>
                <SelectItem value="damas 7ma">Damas 7ma</SelectItem>
            </SelectContent>
        </Select>
    );
}
