"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
    currentDateStr: string;
    displayDate: string;
}

export function ClubDateNavigator({ currentDateStr, displayDate }: Props) {
    const router = useRouter();

    const navigateDate = (daysCount: number) => {
        const [y, m, d] = currentDateStr.split('-');
        const current = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        current.setDate(current.getDate() + daysCount);

        const nextDateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        router.push(`?date=${nextDateStr}`);
    };

    return (
        <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-700 rounded-md overflow-hidden">
            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-neutral-400 hover:text-white rounded-none hover:bg-neutral-800"
                onClick={() => navigateDate(-1)}
            >
                <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center justify-center min-w-[120px] text-sm font-medium text-white px-2">
                <Clock className="w-4 h-4 mr-2 text-neutral-400" />
                {displayDate}
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-neutral-400 hover:text-white rounded-none hover:bg-neutral-800"
                onClick={() => navigateDate(1)}
            >
                <ChevronRight className="w-4 h-4" />
            </Button>
        </div>
    );
}
