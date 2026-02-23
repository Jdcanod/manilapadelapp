import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Trophy, CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function TorneosPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Get all tournaments that are public and upcoming
    const { data: torneos } = await supabase
        .from('torneos')
        .select(`
            *,
            club:users(nombre),
            torneo_parejas(count)
        `)
        .order('fecha_inicio', { ascending: true });

    const torneosFiltrados = (torneos || []).filter(t => new Date(t.fecha_fin) >= new Date());

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
                        <Trophy className="w-8 h-8 text-amber-500" />
                        Torneos
                    </h1>
                    <p className="text-neutral-400">Inscribe a tu pareja y compite por ascender en el Ranking.</p>
                </div>
            </div>

            {!torneosFiltrados || torneosFiltrados.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30">
                    <Trophy className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-neutral-300 mb-2">No hay torneos próximos</h3>
                    <p className="mb-4">Mantente atento, pronto los clubes organizarán nuevos campeonatos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {torneosFiltrados.map((torneo) => {
                        const isUpcoming = new Date(torneo.fecha_inicio) > new Date();

                        let statusColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                        let statusText = "En Curso";

                        if (isUpcoming) {
                            statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
                            statusText = "Próximo / Inscripciones";
                        }

                        const countParejas = (torneo.torneo_parejas && torneo.torneo_parejas[0]?.count) ? torneo.torneo_parejas[0].count : 0;
                        const nombreClub = (torneo.club && torneo.club.nombre) ? torneo.club.nombre : "Club Organizador";

                        return (
                            <Card key={torneo.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4 gap-4">
                                        <div className="flex-1">
                                            <Badge variant="outline" className={`mb-3 ${statusColor}`}>
                                                {statusText}
                                            </Badge>
                                            <h3 className="text-xl font-bold text-white mb-2 leading-tight">{torneo.nombre}</h3>

                                            <div className="flex items-center text-sm text-neutral-400 font-medium mt-3">
                                                <CalendarDays className="w-4 h-4 mr-2 text-neutral-500" />
                                                {new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')} - {new Date(torneo.fecha_fin).toLocaleDateString('es-CO')}
                                            </div>
                                            <div className="flex items-center text-sm text-neutral-400 font-medium mt-1">
                                                <MapPin className="w-4 h-4 mr-2 text-emerald-500" />
                                                {nombreClub}
                                            </div>
                                        </div>
                                        <div className="text-center shrink-0 bg-neutral-950 px-4 py-2 rounded-xl border border-neutral-800">
                                            <div className="text-[10px] text-neutral-500 uppercase tracking-tighter">Inscritos</div>
                                            <div className="text-2xl font-black text-amber-500 leading-none">{countParejas}</div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-neutral-800">
                                        <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold" disabled>
                                            Inscribir Pareja
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
