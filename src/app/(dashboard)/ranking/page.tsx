import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, ArrowUp, ArrowDown, ArrowRight, Medal, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function RankingPage() {
    const rankingData = [
        { rank: 1, name: "Los Cuervos", pts: 2150, diff: "up", m: 45, p1: "05.png", p2: "06.png", level: "Pro" },
        { rank: 2, name: "Paisa Express", pts: 1980, diff: "same", m: 38, p1: "07.png", p2: "08.png", level: "Pro" },
        { rank: 3, name: "Team Smash", pts: 1845, diff: "up", m: 22, p1: "01.png", p2: "09.png", level: "Avanzado" },
        { rank: 4, name: "Los Paisas Pro", pts: 1450, diff: "down", m: 15, p1: "02.png", p2: "03.png", level: "Avanzado", highlight: true },
        { rank: 5, name: "Doble V", pts: 1320, diff: "up", m: 31, p1: "04.png", p2: "10.png", level: "Avanzado" },
        { rank: 6, name: "Team Montaña", pts: 1100, diff: "down", m: 8, p1: "11.png", p2: "12.png", level: "Intermedio" },
        { rank: 7, name: "Novatos FC", pts: 950, diff: "same", m: 4, p1: "13.png", p2: "14.png", level: "Amateur" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-gradient-to-r from-neutral-900 to-neutral-900/60 p-6 rounded-3xl border border-neutral-800 shadow-xl overflow-hidden relative">
                <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

                <div className="z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3 text-amber-500 text-xs font-bold uppercase tracking-wider">
                        <Trophy className="w-4 h-4" /> Temporada Oficial
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white mb-2">Ranking Manizales</h1>
                    <p className="text-neutral-400">Tabla general basada en ELO dinámico.</p>
                </div>

                <div className="z-10 w-full sm:w-auto mt-4 sm:mt-0">
                    <Select defaultValue="todas">
                        <SelectTrigger className="w-full sm:w-[180px] bg-neutral-950 border-neutral-700 text-neutral-100 shadow-md">
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                            <SelectItem value="todas">Todas las categorías</SelectItem>
                            <SelectItem value="pro">Nivel Pro (1ra)</SelectItem>
                            <SelectItem value="avanzadas">Avanzadas (2da / 3ra)</SelectItem>
                            <SelectItem value="intermedias">Intermedias (4ta / 5ta)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="bg-neutral-900/50 border-neutral-800 shadow-2xl backdrop-blur-xl">
                <CardContent className="p-0">
                    <ScrollArea className="h-[600px] w-full rounded-md border-0">
                        <div className="p-4 bg-neutral-950/40 text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-4 sticky top-0 z-20 backdrop-blur-md border-b border-neutral-800/80">
                            <div className="w-12 text-center">Pos</div>
                            <div className="flex-1">Pareja</div>
                            <div className="w-24 text-center hidden md:block">Win Rate</div>
                            <div className="w-32 text-right pr-6">Puntos ELO</div>
                        </div>

                        {rankingData.map((team, idx) => (
                            <div
                                key={idx}
                                className={`group flex items-center gap-4 p-4 border-b border-neutral-800/50 hover:bg-neutral-800/60 transition-colors cursor-pointer ${team.highlight ? 'bg-emerald-950/20 bg-gradient-to-r from-emerald-500/10 to-transparent border-l-2 border-l-emerald-500' : ''
                                    }`}
                            >
                                {/* Posición y Tendencia */}
                                <div className="w-12 flex flex-col items-center justify-center relative">
                                    {team.rank === 1 && <Medal className="w-8 h-8 text-amber-400 absolute opacity-20 -z-10" />}
                                    <span className={`text-2xl font-black ${team.rank === 1 ? 'text-amber-400' :
                                            team.rank === 2 ? 'text-neutral-300' :
                                                team.rank === 3 ? 'text-amber-700' : 'text-neutral-500'
                                        }`}>
                                        {team.rank}
                                    </span>

                                    <div className="flex items-center mt-1 text-[10px] font-bold">
                                        {team.diff === "up" && <ArrowUp className="w-3 h-3 text-emerald-400" />}
                                        {team.diff === "down" && <ArrowDown className="w-3 h-3 text-red-400" />}
                                        {team.diff === "same" && <ArrowRight className="w-3 h-3 text-neutral-600" />}
                                    </div>
                                </div>

                                {/* Info Pareja */}
                                <div className="flex-1 flex items-center gap-4">
                                    <div className="flex -space-x-3">
                                        <Avatar className="w-11 h-11 border-2 border-neutral-900 shadow-md">
                                            <AvatarImage src={`https://ui.shadcn.com/avatars/${team.p1}`} />
                                            <AvatarFallback className="bg-neutral-800 text-neutral-400">P1</AvatarFallback>
                                        </Avatar>
                                        <Avatar className="w-11 h-11 border-2 border-neutral-900 shadow-md">
                                            <AvatarImage src={`https://ui.shadcn.com/avatars/${team.p2}`} />
                                            <AvatarFallback className="bg-neutral-800 text-emerald-500">P2</AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-lg font-bold tracking-tight ${team.highlight ? 'text-emerald-400' : 'text-white'}`}>
                                            {team.name}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-neutral-400 flex items-center">
                                                <Shield className="w-3 h-3 mr-1 opacity-70" /> {team.level}
                                            </span>
                                            {team.highlight && (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-0 h-4">
                                                    TÚ
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* WinRate md+ */}
                                <div className="w-24 text-center hidden md:flex flex-col">
                                    <span className="text-sm font-semibold text-neutral-300">
                                        {Math.min(90, Math.round(team.m * 1.5))}%
                                    </span>
                                    <span className="text-[10px] text-neutral-500">({team.m} PJ)</span>
                                </div>

                                {/* Puntos ELO */}
                                <div className="w-32 text-right pr-4 flex flex-col justify-center">
                                    <span className="text-2xl font-black text-white font-mono">{team.pts}</span>
                                </div>
                            </div>
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>

        </div>
    );
}
