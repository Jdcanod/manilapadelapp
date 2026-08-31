import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, UserCheck, Building2 } from "lucide-react";
import Link from "next/link";
import { createAdminClient } from "@/utils/supabase/server";
import { coincideBusqueda } from "@/lib/display-names";

export default async function SuperAdminPage({ searchParams }: { searchParams?: { q?: string; rol?: string } }) {
    const supabase = createAdminClient();

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [
        { count: jugadoresCount },
        { count: clubesCount },
        { count: partidosMesCount },
        { data: clubesRecientes },
    ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true })
            .eq('rol', 'jugador').not('email', 'ilike', 'invitado_%'),
        supabase.from('users').select('id', { count: 'exact', head: true })
            .eq('rol', 'admin_club'),
        supabase.from('partidos').select('id', { count: 'exact', head: true })
            .gte('fecha', inicioMes.toISOString()),
        supabase.from('users').select('id, nombre, email, fecha_registro')
            .eq('rol', 'admin_club')
            .order('fecha_registro', { ascending: false })
            .limit(5),
    ]);

    const systemStats = [
        { label: "Jugadores Registrados", val: String(jugadoresCount ?? 0), color: "text-blue-400" },
        { label: "Clubes Activos", val: String(clubesCount ?? 0), color: "text-olive" },
        { label: "Partidos (Mes)", val: String(partidosMesCount ?? 0), color: "text-olive/70" },
    ];

    // Directorio de usuarios: búsqueda + filtro por rol (server-side, vía GET).
    // El texto se filtra en memoria (no ILIKE) para ignorar tildes/mayúsculas.
    const q = (searchParams?.q || "").trim();
    const rolFiltro = searchParams?.rol || "todos";
    let usersQuery = supabase
        .from('users')
        .select('id, nombre, apellido, email, rol, ciudad')
        .not('email', 'ilike', 'invitado_%')
        .order('fecha_registro', { ascending: false });
    if (rolFiltro !== "todos") usersQuery = usersQuery.eq('rol', rolFiltro);
    if (!q) usersQuery = usersQuery.limit(15);
    const { data: usersData } = await usersQuery;
    const recentUsers = q
        ? (usersData || []).filter(u => coincideBusqueda(`${u.nombre || ""} ${u.apellido || ""} ${u.email || ""}`, q)).slice(0, 15)
        : (usersData || []);

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
                {/* Clubes recientes — la creación de un club es inmediata (superadmin
                    la hace desde /superadmin/clubes), no hay flujo de "solicitud
                    pendiente" que validar todavía. */}
                <Card className="bg-paper-soft border-olive/20 shadow-xl overflow-hidden">
                    <div className="h-1 w-full bg-ochre" />
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-ink text-lg flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-ochre-dark" /> Últimos Clubes Creados
                            </CardTitle>
                            <Badge variant="secondary" className="bg-ochre/20 text-ochre-dark border-ochre/50">{clubesCount ?? 0} total</Badge>
                        </div>
                        <CardDescription className="text-olive">Los 5 clubes más recientes de la plataforma.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-paper/50">
                                <TableRow className="border-olive/20 hover:bg-paper-soft/50">
                                    <TableHead className="text-ink">Club</TableHead>
                                    <TableHead className="text-ink">Correo</TableHead>
                                    <TableHead className="text-right text-ink">Creado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(!clubesRecientes || clubesRecientes.length === 0) ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-olive/70">
                                            No hay clubes registrados todavía.
                                        </TableCell>
                                    </TableRow>
                                ) : clubesRecientes.map((club) => (
                                    <TableRow key={club.id} className="border-olive/20 hover:bg-paper-dark/50">
                                        <TableCell className="font-medium text-ink">
                                            <Link href="/superadmin/clubes" className="hover:underline">{club.nombre}</Link>
                                        </TableCell>
                                        <TableCell className="text-olive text-sm">{club.email}</TableCell>
                                        <TableCell className="text-right text-xs text-olive/70">
                                            {club.fecha_registro ? new Date(club.fecha_registro).toLocaleDateString('es-CO') : '—'}
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
                        <form method="GET" className="mt-4 flex gap-2">
                            <Input name="q" defaultValue={q} placeholder="Buscar por email, nombre..." className="bg-paper border-olive/20 text-ink" />
                            <Select name="rol" defaultValue={rolFiltro}>
                                <SelectTrigger className="w-[120px] bg-paper border-olive/20 text-ink">
                                    <SelectValue placeholder="Rol" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="jugador">Jugador</SelectItem>
                                    <SelectItem value="admin_club">Club</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button type="submit" size="sm" variant="outline" className="bg-paper border-olive/20 text-ink hover:bg-paper-dark">
                                Buscar
                            </Button>
                        </form>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-paper/50">
                                <TableRow className="border-olive/20 hover:bg-paper-soft/50">
                                    <TableHead className="text-ink">Usuario</TableHead>
                                    <TableHead className="text-ink">Rol</TableHead>
                                    <TableHead className="text-right text-ink">Ciudad</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(!recentUsers || recentUsers.length === 0) ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-olive/70">
                                            Sin resultados.
                                        </TableCell>
                                    </TableRow>
                                ) : recentUsers.map((u) => (
                                    <TableRow key={u.id} className="border-olive/20 hover:bg-paper-dark/50">
                                        <TableCell className="font-medium text-ink">
                                            {[u.nombre, u.apellido].filter(Boolean).join(' ') || u.email}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-xs ${u.rol === 'jugador' ? 'text-blue-400 border-blue-400/30' : 'text-olive border-olive/30'}`}>
                                                {u.rol === 'jugador' ? 'Jugador' : u.rol === 'admin_club' ? 'Admin Club' : u.rol}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-olive/70">
                                            {u.ciudad || '—'}
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
