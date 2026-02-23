"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Megaphone, Trophy, Flame, Info } from "lucide-react";
import { deleteNewsAction } from "./actions";
import { useState } from "react";

export type NewsItem = {
    id: string;
    club_id: string;
    tipo: string;
    titulo: string;
    contenido: string;
    created_at: string;
    club_nombre?: string;
};

export function NovedadesList({ news, currentUserId }: { news: NewsItem[], currentUserId: string | null }) {
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que deseas eliminar este anuncio?")) return;
        setIsDeleting(id);
        try {
            await deleteNewsAction(id);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            alert("No se pudo eliminar el anuncio: " + msg);
        } finally {
            setIsDeleting(null);
        }
    };

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'torneo': return <Trophy className="w-4 h-4 mr-1 text-amber-500" />;
            case 'promocion': return <Flame className="w-4 h-4 mr-1 text-orange-500" />;
            case 'clase': return <Megaphone className="w-4 h-4 mr-1 text-emerald-500" />;
            default: return <Info className="w-4 h-4 mr-1 text-blue-500" />;
        }
    };

    const getColor = (tipo: string) => {
        switch (tipo) {
            case 'torneo': return "border-amber-500/50 bg-amber-500/10 text-amber-500";
            case 'promocion': return "border-orange-500/50 bg-orange-500/10 text-orange-500";
            case 'clase': return "border-emerald-500/50 bg-emerald-500/10 text-emerald-500";
            default: return "border-blue-500/50 bg-blue-500/10 text-blue-500";
        }
    };

    const formatLabel = (tipo: string) => {
        switch (tipo) {
            case 'torneo': return "Torneo";
            case 'promocion': return "Promoción";
            case 'clase': return "Clases";
            default: return "Aviso";
        }
    };

    if (news.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-neutral-800 rounded-2xl bg-neutral-900/50">
                <Megaphone className="w-12 h-12 text-neutral-600 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No hay novedades recientes</h3>
                <p className="text-neutral-400 max-w-sm">Los clubes aún no han publicado anuncios en esta zona. ¡Vuelve pronto!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => {
                const isOwner = currentUserId && item.club_id === currentUserId;
                const formattedDate = new Date(item.created_at).toLocaleDateString("es-CO", {
                    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
                });

                return (
                    <Card key={item.id} className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden flex flex-col group relative">
                        {isOwner && (
                            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8 bg-black/60 hover:bg-red-600 border border-neutral-800"
                                    onClick={() => handleDelete(item.id)}
                                    disabled={isDeleting === item.id}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <CardHeader className="pb-3 border-b border-neutral-800/50 bg-neutral-950/30">
                            <div className="flex justify-between items-start mb-2">
                                <Badge variant="outline" className={`capitalize shadow-lg ${getColor(item.tipo)}`}>
                                    {getIcon(item.tipo)}
                                    {formatLabel(item.tipo)}
                                </Badge>
                                <span className="text-[10px] text-neutral-500">{formattedDate}</span>
                            </div>
                            <CardTitle className="text-lg font-bold text-white leading-tight">
                                {item.titulo}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 flex-1">
                            <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                                {item.contenido}
                            </p>
                        </CardContent>
                        <CardFooter className="bg-neutral-950/50 border-t border-neutral-800 py-3">
                            <div className="flex items-center text-xs text-neutral-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                                Club: <span className="text-white ml-1 font-bold">{item.club_nombre || 'Club de Manizales'}</span>
                            </div>
                        </CardFooter>
                    </Card>
                );
            })}
        </div>
    );
}
