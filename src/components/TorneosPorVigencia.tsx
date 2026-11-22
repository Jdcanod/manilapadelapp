"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

/**
 * Las dos pestañas de la lista de torneos: los que siguen vivos (próximos y
 * en curso) y los que ya terminaron. Se abre en Activos; lo pasado no ocupa
 * espacio hasta que se pide.
 *
 * El contenido de cada pestaña lo arma la página (en el servidor); esto solo
 * alterna entre las dos.
 */
export function TorneosPorVigencia({
    activos,
    pasados,
    cantidadActivos,
    cantidadPasados,
}: {
    activos: ReactNode;
    pasados: ReactNode;
    cantidadActivos: number;
    cantidadPasados: number;
}) {
    return (
        <Tabs defaultValue="activos" className="space-y-4">
            <TabsList className="bg-paper-soft border border-olive/20 p-1">
                <TabsTrigger value="activos" className="text-xs sm:text-sm px-3 sm:px-5 data-[state=active]:bg-paper-dark">
                    Activos
                    <Badge variant="secondary" className="ml-2 bg-paper-dark text-olive border-none">{cantidadActivos}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pasados" className="text-xs sm:text-sm px-3 sm:px-5 data-[state=active]:bg-paper-dark">
                    Pasados
                    <Badge variant="secondary" className="ml-2 bg-paper-dark text-olive border-none">{cantidadPasados}</Badge>
                </TabsTrigger>
            </TabsList>
            <TabsContent value="activos" className="mt-0">{activos}</TabsContent>
            <TabsContent value="pasados" className="mt-0">{pasados}</TabsContent>
        </Tabs>
    );
}
