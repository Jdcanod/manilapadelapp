import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, UserCheck, TrendingUp, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export default function SuperAdminPage() {
    const pendingClubs = [
        { id: "1", name: "La Enea Padel Zone", owner: "Carlos (club@laenea.com)", requested: "Hace 2 días" },
        { id: "2", name: "Padel x Tres", owner: "Santiago M.", requested: "Ayer" },
    ];

    const recentUsers = [
        { id: "101", name: "Felipe Ruiz", role: "Jugador", rankPoints: 1200, status: "Activo" },
        { id: "102", name: "Club Owner Manizales", role: "Admin Club", rankPoints: null, status: "Verificado" },
        { id: "103", name: "Andrés B.", role: "Jugador", rankPoints: 1450, status: "Activo" },
    ];

    const systemStats = [
        { label: "Jugadores Manizales", val: "450", color: "text-blue-400" },
        { label: "Partidos (Mes)", val: "324", color: "text-olive" },
        { label: "Alertas ELO", val: "0", color: "text-olive/70" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-olive/20 pb-6 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-ink mb-1">Super Admin Panel</h1>
                        <p className="text-olive text-sm">Visión general y herramientas de moderación global.</p>
                    </div>
                </div>
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {systemStats.map((stat, i) => (
                    <Card key={i} className="bg-paper border-olive/20 shadow-md">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-olive text-xs font-bold uppercase tracking-wider">{stat.label}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-5xl font-black ${stat.color} drop-shadow-sm`}>{stat.val}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Validar Clubes Nuevos */}
                <Card className="bg-paper-soft border-olive/20 shadow-xl overflow-hidden">
                    <div className="h-1 w-full bg-ochre" />
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-ink text-lg flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-ochre-dark" /> Validación de Clubes
                            </CardTitle>
                            <Badge variant="secondary" className="bg-ochre/20 text-ochre-dark border-ochre/50">2 Pendientes</Badge>
                        </div>
                        <CardDescription className="text-olive">Revisa la documentación antes de publicarlos en la plataforma.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-paper/50">
                                <TableRow className="border-olive/20 hover:bg-paper-soft/50">
                                    <TableHead className="text-ink">Club</TableHead>
                                    <TableHead className="text-ink">Solicitante</TableHead>
                                    <TableHead className="text-right text-ink">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingClubs.map((club) => (
                                    <TableRow key={club.id} className="border-olive/20 hover:bg-paper-dark/50">
                                        <TableCell className="font-medium text-ink">{club.name}</TableCell>
                                        <TableCell className="text-olive text-sm">
                                            {club.owner} <br />
                                            <span className="text-xs text-olive/70">{club.requested}</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="outline" className="h-8 w-8 bg-paper border-red-500/30 hover:bg-red-500/10 hover:text-red-400 text-olive transition-colors">
                                                    <XCircle className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" className="h-8 w-8 bg-olive hover:bg-olive text-paper shadow-lg">
                                                    <CheckCircle className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Users Global Search */}
                <Card className="bg-paper-soft border-olive/20 shadow-xl overflow-hidden">
                    <div className="h-1 w-full bg-blue-500" />
                    <CardHeader>
                        <CardTitle className="text-ink text-lg flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-blue-500" /> Directorio de Usuarios
                        </CardTitle>
                        <div className="mt-4 flex gap-2">
                            <Input placeholder="Buscar por email, nombre o ID..." className="bg-paper border-olive/20 text-ink" />
                            <Select defaultValue="todos">
                                <SelectTrigger className="w-[120px] bg-paper border-olive/20 text-ink">
                                    <SelectValue placeholder="Rol" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="jugador">Jugador</SelectItem>
                                    <SelectItem value="club">Club</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-paper/50">
                                <TableRow className="border-olive/20 hover:bg-paper-soft/50">
                                    <TableHead className="text-ink">Usuario</TableHead>
                                    <TableHead className="text-ink">Rol</TableHead>
                                    <TableHead className="text-right text-ink">Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentUsers.map((u) => (
                                    <TableRow key={u.id} className="border-olive/20 hover:bg-paper-dark/50">
                                        <TableCell className="font-medium text-ink">
                                            {u.name}
                                            {u.rankPoints && <span className="text-xs text-olive/70 flex items-center mt-1"><TrendingUp className="w-3 h-3 mr-1" /> {u.rankPoints} pts</span>}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-xs ${u.role === 'Jugador' ? 'text-blue-400 border-blue-400/30' : 'text-olive border-olive/30'
                                                }`}>
                                                {u.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`text-sm font-medium ${u.status === 'Verificado' ? 'text-olive' : 'text-ink'}`}>
                                                {u.status}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
