import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Plus, Swords, UserPlus } from "lucide-react";
import Link from "next/link";

export default function PartidosPage() {
    const openMatches = [
        {
            id: "1",
            club: "Manizales Padel Central",
            time: "Hoy, 20:00",
            type: "Dobles Mixtos",
            spotsLeft: 2,
            level: "Avanzado / Intermedio",
            players: ["Andrés", "Luisa"]
        },
        {
            id: "2",
            club: "Bosque Padel",
            time: "Mañana, 18:00",
            type: "Amistoso",
            spotsLeft: 1,
            level: "Cualquier nivel",
            players: ["Carlos", "Esteban", "Diego"]
        }
    ];

    const myMatches = [
        {
            id: "3",
            club: "Manizales Padel Central",
            time: "Hoy, 19:30",
            type: "Competitivo (Rankeado)",
            status: "Confirmado",
            opponents: "Team Montaña"
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Partidos</h1>
                    <p className="text-neutral-400">Encuentra y organiza tus encuentros en Manizales.</p>
                </div>
                <Link href="/partidos/nuevo">
                    <Button className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-900/30 w-full sm:w-auto">
                        <Plus className="w-5 h-5 mr-2" />
                        Organizar Partido
                    </Button>
                </Link>
            </div>

            <Tabs defaultValue="buscar" className="w-full">
                <TabsList className="bg-neutral-900 border border-neutral-800 p-1 w-full sm:w-auto mb-6">
                    <TabsTrigger value="buscar" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Buscar Partidos
                    </TabsTrigger>
                    <TabsTrigger value="mis-partidos" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Mis Partidos
                        <Badge variant="secondary" className="ml-2 bg-emerald-500 text-white hover:bg-emerald-600">
                            1
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="buscar" className="space-y-4">
                    {openMatches.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30">
                            No hay partidos abiertos en este momento. ¡Sé el primero en organizar uno!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {openMatches.map((match) => (
                                <Card key={match.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10 mb-2">
                                                    {match.type}
                                                </Badge>
                                                <h3 className="text-lg font-bold text-white mb-1">{match.club}</h3>
                                                <div className="flex items-center text-sm text-neutral-400 font-medium">
                                                    <Calendar className="w-4 h-4 mr-2 text-emerald-500" />
                                                    {match.time}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Faltan</div>
                                                <div className="text-2xl font-black text-amber-500">{match.spotsLeft}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-800">
                                            <div className="flex -space-x-2">
                                                {match.players.map((_, i) => (
                                                    <Avatar key={i} className="border-2 border-neutral-900 w-8 h-8">
                                                        <AvatarImage src={`https://ui.shadcn.com/avatars/0${i + 1}.png`} />
                                                    </Avatar>
                                                ))}
                                            </div>
                                            <Button size="sm" className="bg-white text-neutral-950 hover:bg-neutral-200">
                                                <UserPlus className="w-4 h-4 mr-2" />
                                                Unirse
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="mis-partidos" className="space-y-4">
                    {myMatches.map((match) => (
                        <Card key={match.id} className="bg-neutral-900/80 border-neutral-800 relative overflow-hidden group hover:bg-neutral-900 transition-colors">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex-1 w-full text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                        <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0">{match.status}</Badge>
                                        <Badge variant="outline" className="border-neutral-700 text-neutral-400">{match.type}</Badge>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">vs {match.opponents}</h3>
                                    <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-6 text-sm text-neutral-400">
                                        <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> {match.time}</span>
                                        <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5" /> {match.club}</span>
                                    </div>
                                </div>
                                <div className="flex md:flex-col gap-3 w-full md:w-auto">
                                    <Link href={`/partidos/${match.id}`} className="w-full">
                                        <Button variant="secondary" className="w-full bg-neutral-800 hover:bg-neutral-700 text-white">Detalles</Button>
                                    </Link>
                                    <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 hidden group-hover:flex">
                                        <Swords className="w-4 h-4 mr-2" />
                                        Confirmar Resultado
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}
