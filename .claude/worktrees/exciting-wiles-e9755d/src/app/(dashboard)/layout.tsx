import Link from "next/link";
import { Trophy, Home, User, Calendar, Megaphone, MapPin, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/server";
import { cerrarSesionAction } from "@/app/actions/auth";
import { BrandLogo } from "@/components/BrandLogo";

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
        <div className="min-h-screen bg-paper text-ink pb-20 md:pb-0 md:flex flex-col">
            {/* Top Header (desktop + mobile) */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-paper/85 border-b border-olive/15 shadow-sm">
                <div className="max-w-7xl mx-auto w-full flex h-16 items-center justify-between px-4 md:px-6">
                    <BrandLogo
                        size="sm"
                        href={rolUsuario === "jugador" ? "/jugador" : rolUsuario === "superadmin" ? "/superadmin" : "/club"}
                    />
                    <nav className="hidden md:flex items-center gap-5 ml-8">
                        {rolUsuario === "jugador" ? (
                            <>
                                <Link href="/jugador" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Inicio</Link>
                                <Link href="/partidos" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Partidos</Link>
                                <Link href="/torneos" className="text-xs font-black uppercase tracking-widest text-ochre-dark hover:text-ochre transition-colors">Torneos</Link>
                                <Link href="/clubes" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Clubes</Link>
                                <Link href="/ranking" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Ranking</Link>
                                <Link href="/novedades" className="text-xs font-black uppercase tracking-widest text-ochre-dark hover:text-ochre transition-colors">Muro</Link>
                            </>
                        ) : rolUsuario === "superadmin" ? (
                            <>
                                <Link href="/superadmin" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Panel</Link>
                                <Link href="/superadmin/torneos" className="text-xs font-black uppercase tracking-widest text-ochre-dark hover:text-ochre transition-colors">Torneos Ciudad</Link>
                                <Link href="/superadmin/clubes" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Clubes</Link>
                                <Link href="/superadmin/jugadores" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Jugadores</Link>
                            </>
                        ) : (
                            <>
                                <Link href="/club" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Dashboard</Link>
                                <Link href="/club/torneos" className="text-xs font-black uppercase tracking-widest text-ochre-dark hover:text-ochre transition-colors">Torneos</Link>
                                <Link href="/ranking" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Jugadores</Link>
                                <Link href="/novedades" className="text-xs font-black uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">Novedades</Link>
                            </>
                        )}
                    </nav>

                    <div className="flex items-center gap-3 ml-auto">
                        {rolUsuario === "superadmin" && (
                            <form action={cerrarSesionAction} className="hidden lg:inline">
                                <button type="submit" className="text-[10px] font-black uppercase tracking-widest text-ochre-dark hover:text-ochre transition-colors flex items-center gap-1">
                                    <LogOut className="w-3 h-3" /> Salir
                                </button>
                            </form>
                        )}

                        <div className="flex flex-col text-right">
                            <span className="text-xs font-bold text-ink line-clamp-1 max-w-[120px]">{nombreReal}</span>
                            {rolUsuario === "jugador" && (
                                <span className="text-[10px] text-ochre-dark font-black">{puntosUsuario} pts</span>
                            )}
                        </div>
                        <Link href={rolUsuario === "jugador" ? "/jugador/perfil" : rolUsuario === "admin_club" ? "/club/configuracion" : "/superadmin"}>
                            <Avatar className="h-9 w-9 border-2 border-olive/20 hover:border-ochre transition-all cursor-pointer ring-2 ring-transparent hover:ring-ochre/20">
                                <AvatarImage src={fotoUrl} alt={nombreReal} />
                                <AvatarFallback className="bg-paper-soft text-olive font-bold">{iniciales}</AvatarFallback>
                            </Avatar>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-10">
                {children}
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="fixed bottom-0 w-full z-40 bg-paper/95 backdrop-blur-xl border-t border-olive/15 md:hidden pb-safe shadow-[0_-4px_12px_rgba(94,97,24,0.08)]">
                <div className="flex justify-between items-center h-16 px-2">
                    {rolUsuario === "jugador" ? (
                        <>
                            <Link href="/jugador" className="flex flex-col items-center justify-center flex-1 h-full text-olive">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Inicio</span>
                            </Link>
                            <Link href="/partidos" className="flex flex-col items-center justify-center flex-1 h-full text-olive/60">
                                <Calendar className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Partidos</span>
                            </Link>
                            <Link href="/torneos" className="flex flex-col items-center justify-center flex-1 h-full text-ochre-dark">
                                <Trophy className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Torneos</span>
                            </Link>
                            <Link href="/clubes" className="flex flex-col items-center justify-center flex-1 h-full text-olive/60">
                                <MapPin className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Clubes</span>
                            </Link>
                            <Link href="/jugador/perfil" className="flex flex-col items-center justify-center flex-1 h-full text-olive/60">
                                <User className="w-5 h-5 mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Perfil</span>
                            </Link>
                        </>
                    ) : rolUsuario === "superadmin" ? (
                        <>
                            <Link href="/superadmin" className="flex flex-col items-center justify-center w-full h-full text-olive">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-black uppercase">Panel</span>
                            </Link>
                            <Link href="/superadmin/torneos" className="flex flex-col items-center justify-center w-full h-full text-ochre-dark">
                                <Trophy className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-black uppercase">Torneos</span>
                            </Link>
                            <Link href="/superadmin/jugadores" className="flex flex-col items-center justify-center w-full h-full text-olive">
                                <User className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-black uppercase">Jugadores</span>
                            </Link>
                            <form action={cerrarSesionAction} className="flex flex-col items-center justify-center w-full h-full text-olive/60">
                                <button type="submit" className="flex flex-col items-center justify-center w-full h-full">
                                    <LogOut className="w-5 h-5 mb-1" />
                                    <span className="text-[10px] font-black uppercase">Salir</span>
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            <Link href="/club" className="flex flex-col items-center justify-center w-full h-full text-olive">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-black uppercase">Dashboard</span>
                            </Link>
                            <Link href="/club/torneos" className="flex flex-col items-center justify-center w-full h-full text-ochre-dark">
                                <Trophy className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-black uppercase">Torneos</span>
                            </Link>
                            <Link href="/ranking" className="flex flex-col items-center justify-center w-full h-full text-olive/60">
                                <User className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-black uppercase">Jugadores</span>
                            </Link>
                            <Link href="/novedades" className="flex flex-col items-center justify-center w-full h-full text-olive/60">
                                <Megaphone className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-black uppercase">Novedades</span>
                            </Link>
                        </>
                    )}
                </div>
            </nav>
        </div>
    )
}
