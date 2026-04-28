"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";

interface Props {
    torneos: { id: string; nombre: string }[];
    selectedTorneo?: string;
    queryText?: string;
}

export function ResultadosFilter({ torneos, selectedTorneo, queryText }: Props) {
    const router = useRouter();
    const params = useSearchParams();
    const [text, setText] = useState(queryText || '');

    // Debounce: actualiza la URL 400ms después de que pares de teclear
    useEffect(() => {
        const t = setTimeout(() => {
            const sp = new URLSearchParams(params?.toString() || '');
            if (text) sp.set('q', text);
            else sp.delete('q');
            router.replace(`/club/resultados-pendientes?${sp.toString()}`);
        }, 400);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text]);

    const onSelectTorneo = (id: string) => {
        const sp = new URLSearchParams(params?.toString() || '');
        if (id) sp.set('torneo', id);
        else sp.delete('torneo');
        router.replace(`/club/resultados-pendientes?${sp.toString()}`);
    };

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            {/* Búsqueda por texto */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Buscar por pareja, torneo o lugar…"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-10 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/40 transition-colors"
                />
                {text && (
                    <button
                        onClick={() => setText('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Selector de torneo */}
            <select
                value={selectedTorneo || ''}
                onChange={e => onSelectTorneo(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors min-w-[200px]"
            >
                <option value="">Todos los torneos</option>
                {torneos.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
            </select>
        </div>
    );
}
