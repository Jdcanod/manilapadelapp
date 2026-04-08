"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Users } from "lucide-react";
import { generarFaseGrupos } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
    torneoId: string;
    categorias: string[];
    gruposExistentes: any[];
}

export function TournamentGroupsManager({ torneoId, categorias, gruposExistentes }: Props) {
    const [isPending, startTransition] = useTransition();
    const [selectedCat] = useState(categorias[0] || "General");

    const onGenerate = () => {
        if (!confirm(`¿Estás seguro de generar el sorteo para la categoría ${selectedCat}? Esto creará los grupos y partidos automáticamente.`)) return;
        
        startTransition(async () => {
            try {
                await generarFaseGrupos(torneoId, selectedCat);
                alert("¡Fase de grupos generada con éxito!");
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    const gruposCategoria = gruposExistentes.filter(g => g.categoria === selectedCat);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-900 p-4 border border-neutral-800 rounded-xl">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Swords className="w-5 h-5 text-emerald-500" />
                        Sorteo de Fase de Grupos
                    </h3>
                    <p className="text-sm text-neutral-400">Genera grupos de 3 o 4 parejas balanceados por ranking.</p>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                        onClick={onGenerate}
                        disabled={isPending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                        {isPending ? "Generando..." : "Realizar Sorteo"}
                    </Button>
                </div>
            </div>

            {gruposCategoria.length === 0 ? (
                <div className="text-center py-12 bg-neutral-950/30 border border-neutral-800 border-dashed rounded-xl">
                    <Users className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                    <p className="text-neutral-500">No se han generado grupos para esta categoría aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {gruposCategoria.map((grupo) => (
                        <Card key={grupo.id} className="bg-neutral-900 border-neutral-800 border-l-4 border-l-emerald-500">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-xl font-bold text-white">{grupo.nombre_grupo}</h4>
                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                        Round Robin
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    {/* Aquí mostraremos los integrantes del grupo próximamente */}
                                    <p className="text-xs text-neutral-500 italic">Toca el grupo para ver enfrentamientos y tabla de posiciones.</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
