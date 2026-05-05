import Link from "next/link";
import { Trophy, Home, User, Calendar, Megaphone, MapPin, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/server";
import { cerrarSesionAction } from "@/app/actions/auth";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let nombreReal = "Usuario";
    let iniciales = "US";
    let fotoUrl = "";
    let rolUsuario = "jugador";
    let puntosUsuario = 1000;

    if (user) {
        const { data: userData } = await supabase
            .from('users')
            .select('nombre, rol, puntos_ranking, foto')
            .eq('auth_id', user.id)
            .single();

        if (userData?.nombre) {
            nombreReal = userData.nombre;
            iniciales = nombreReal.substring(0, 2).toUpperCase();
        }
        if (userData?.foto) {
            fotoUrl = userData.foto;
        }
        if (userData?.rol) {
            rolUsuario = userData.rol;
        }
        if (userData?.puntos_ranking !== undefined && userData?.puntos_ranking !== null) {
            puntosUsuario = userData.puntos_ranking;
        }
    }
    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-50 pb-20 md:pb-0 md:flex flex-col">
            {/* Mobile Top Header */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-neutral-950/80 border-b border-neutral-800">
                <div className="max-w-7xl mx-auto w-full flex h-16 items-center justify-between px-4 md:px-6">
                    <Link href={rolUsuario === "jugador" ? "/jugador" : "/club"} className="flex items-center gap-3">
                        <div className="w-10 h-10 overflow-hidden rounded-lg flex items-center justify-center bg-neutral-900 border border-neutral-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/logo.png" alt="Logo Manila" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-black tracking-tighter text-white text-xl hidden sm:inline-block">MANILA<span className="text-emerald-500">PADEL</span></span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-6 ml-8">
                        {rolUsuario === "jugador" ? (
                            <>
                                <Link href="/jugador" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Inicio</Link>
                                <Link href="/partidos" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Partidos</Link>
                                <Link href="/torneos" className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors">Torneos</Link>
                                <Link href="/clubes" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Clubes</Link>
                                <Link href="/ranking" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors font-semibold">Ranking ELO</Link>
                                <Link href="/novedades" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">Muro</Link>
                            </>
                        ) : rolUsuario === "superadmin" ? (
                            <>
                                <Link href="/superadmin" className="text-sm font-medium text-red-500 hover:text-red-400 transition-colors">Admin Panel</Link>
                                <Link href="/superadmin/torneos" className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors">Torneos Ciudad</Link>
                                <Link href="/superadmin/clubes" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Clubes</Link>
                                <Link href="/superadmin/jugadores" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Jugadores ELO</Link>
                            </>
                        ) : (
                            <>
                                <Link href="/club" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">Dashboard</Link>
                                <Link href="/club/torneos" className="text-sm font-medium text-amber-500 hover:text-amber-400 transition-colors">Torneos</Link>
                                <Link href="/ranking" className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors">Jugadores</Link>
                                <Link href="/novedades" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">Novedades</Link>
                            </>
                        )}
                    </nav>

                    <div className="flex items-center gap-4 ml-auto">
                        {rolUsuario === "superadmin" && (
                            <div className="hidden lg:flex items-center gap-3 mr-4 border-r border-neutral-800 pr-4">
                                <Link href="/superadmin" className="text-xs font-semibold text-red-500 hover:text-red-400 border border-red-500/30 px-2 py-1 rounded bg-red-500/10">Admin Panel</Link>
                                <form action={cerrarSesionAction} className="inline">
                                    <button type="submit" className="text-xs font-semibold text-neutral-500 hover:text-red-400 transition-colors ml-2 flex items-center gap-1">
                                        <LogOut className="w-3 h-3" /> Salir
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="flex flex-col text-right">
                            <span className="text-sm font-bold text-white line-clamp-1 max-w-[120px]">{nombreReal}</span>
                            {rolUsuario === "jugador" && (
                                <span className="text-xs text-green-400 font-black">{puntosUsuario} pts</span>
                            )}
                        </div>
                        <Link href={rolUsuario === "jugador" ? "/jugador/perfil" : rolUsuario === "admin_club" ? "/club/configuracion" : "/superadmin"}>
                            <Avatar className="h-9 w-9 border-2 border-neutral-800 hover:border-emerald-500 transition-all cursor-pointer ring-2 ring-transparent hover:ring-emerald-500/20">
                                <AvatarImage src={fotoUrl} alt={nombreReal} />
                                <AvatarFallback className="bg-neutral-800 text-neutral-300 font-bold">{iniciales}</AvatarFallback>
                            </Avatar>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-10">
                {children}
            </main>

            {/* Mobile Bottom Navigation Bar - Optimized spacing and items */}
            <nav className="fixed bottom-0 w-full z-40 bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-800 md:hidden pb-safe">
                <div className="flex justify-between items-center h-16 px-2">
                    {rolUsuario === "jugador" ? (
                        <>
                            <Link href="/jugador" className="flex flex-col items-center justify-center flex-1 h-full text-emerald-500">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter">Inicio</span>
                            </Link>
                            <Link href="/partidos" className="flex flex-col items-center justify-center flex-1 h-full text-neutral-400">
                                <Calendar className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter">Partidos</span>
                            </Link>
                            <Link href="/torneos" className="flex flex-col items-center justify-center flex-1 h-full text-amber-500">
                                <Trophy className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter">Torneos</span>
                            </Link>
                            <Link href="/clubes" className="flex flex-col items-center justify-center flex-1 h-full text-neutral-400">
                                <MapPin className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter">Clubes</span>
                            </Link>
                            <Link href="/jugador/perfil" className="flex flex-col items-center justify-center flex-1 h-full text-neutral-400">
                                <User className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-bold uppercase tracking-tighter">Perfil</span>
                            </Link>
                        </>
                    ) : rolUsuario === "superadmin" ? (
                        <>
                            <Link href="/superadmin" className="flex flex-col items-center justify-center w-full h-full text-red-500">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Panel Admin</span>
                            </Link>
                            <Link href="/superadmin/torneos" className="flex flex-col items-center justify-center w-full h-full text-amber-500 hover:text-amber-400 transition-colors">
                                <Trophy className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Torneos</span>
                            </Link>
                            <Link href="/superadmin/jugadores" className="flex flex-col items-center justify-center w-full h-full text-emerald-500 hover:text-emerald-400 transition-colors">
                                <User className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Jugadores</span>
                            </Link>
                            <form action={cerrarSesionAction} className="flex flex-col items-center justify-center w-full h-full text-neutral-500">
                                <button type="submit" className="flex flex-col items-center justify-center w-full h-full">
                                    <LogOut className="w-5 h-5 mb-1 text-red-500/70" />
                                    <span className="text-[10px] font-medium">Cerrar Sesión</span>
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <Link href="/club" className="flex flex-col items-center justify-center w-full h-full text-emerald-500">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Dashboard</span>
                            </Link>
                            <Link href="/club/torneos" className="flex flex-col items-center justify-center w-full h-full text-amber-500 hover:text-amber-400 transition-colors">
                                <Trophy className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Torneos</span>
                            </Link>
                            <Link href="/ranking" className="flex flex-col items-center justify-center w-full h-full text-purple-400 hover:text-purple-300 transition-colors">
                                <User className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Jugadores</span>
                            </Link>
                            <Link href="/novedades" className="flex flex-col items-center justify-center w-full h-full text-blue-400 hover:text-blue-300 transition-colors">
                                <Megaphone className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Novedades</span>
                            </Link>
                        </>
                    )}
                </div>
            </nav>
        </div>
    )
}
