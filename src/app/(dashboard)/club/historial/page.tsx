import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, MapPin, Users, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function HistorialClubPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    const nombreClub = userData?.nombre || "Mi Club";

    // Obtener todos los partidos jugados en este club
    const { data: partidos } = await supabase
        .from('partidos')
        .select(`
            *,
            creador:users!creador_id(nombre)
        `)
        .ilike('lugar', `${nombreClub}%`)
        .eq('estado', 'jugado')
        .order('fecha', { ascending: false });

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/club" className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white hover:bg-neutral-800 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <History className="w-6 h-6 text-emerald-500" />
                            Historial de {nombreClub}
                        </h1>
                        <p className="text-neutral-500 text-sm">Registro completo de todos los partidos finalizados.</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                {!partidos || partidos.length === 0 ? (
                    <div className="text-center py-24 bg-neutral-900/30 border border-neutral-800 border-dashed rounded-3xl">
                        <History className="w-16 h-16 text-neutral-800 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white">No hay historial aún</h2>
                        <p className="text-neutral-500 max-w-xs mx-auto">
                            Los partidos aparecerán aquí una vez que hayan finalizado y se registren sus resultados.
                        </p>
                    </div>
                ) : (
                    partidos.map((partido) => (
                        <Card key={partido.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                            <CardContent className="p-5">
                                <div className="flex flex-col md:flex-row justify-between gap-6">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Badge className={partido.tipo_partido?.toLowerCase().includes('torneo') ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}>
                                                {partido.tipo_partido}
                                            </Badge>
                                            <span className="text-xs text-neutral-500">
                                                {new Date(partido.fecha).toLocaleString('es-CO', { 
                                                    weekday: 'short', 
                                                    day: 'numeric', 
                                                    month: 'long', 
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="flex items-center gap-2 text-white font-medium">
                                                <MapPin className="w-4 h-4 text-neutral-500" />
                                                {partido.lugar}
                                            </div>
                                            <div className="flex items-center gap-2 text-neutral-400 text-sm">
                                                <Users className="w-4 h-4" />
                                                Organizado por {partido.creador?.nombre || 'Administrador'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-neutral-800">
                                        <div className="text-right">
                                            <div className="text-[10px] text-neutral-500 uppercase font-black mb-1">Resultado</div>
                                            <div className="text-2xl font-black text-white tracking-widest bg-neutral-950 px-4 py-1 rounded-lg border border-neutral-800">
                                                {partido.resultado || "0-0"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
