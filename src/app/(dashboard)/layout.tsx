import Link from "next/link";
import { Trophy, Home, User, Calendar } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let nombreReal = "Usuario";
    let iniciales = "US";
    let rolUsuario = "jugador";

    if (user) {
        const { data: userData } = await supabase
            .from('users')
            .select('nombre, rol')
            .eq('auth_id', user.id)
            .single();

        if (userData?.nombre) {
            nombreReal = userData.nombre;
            // Get first word or up to two characters for the avatar fallback
            iniciales = nombreReal.substring(0, 2).toUpperCase();
        }
        if (userData?.rol) {
            rolUsuario = userData.rol;
        }
    }
    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-50 pb-20 md:pb-0 md:flex flex-col">
            {/* Mobile Top Header */}
            <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-neutral-950/80 border-b border-neutral-800">
                <div className="flex h-16 items-center justify-between px-4 md:px-6">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center shadow-sm">
                            <Trophy className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold tracking-tight text-white hidden sm:inline-block">ManilaPadel</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-6 ml-8">
                        {rolUsuario !== "admin_club" ? (
                            <>
                                <Link href="/jugador" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Inicio</Link>
                                <Link href="/partidos" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Partidos</Link>
                                <Link href="/clubes" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Clubes</Link>
                                <Link href="/ranking" className="text-sm font-medium text-amber-500/80 hover:text-amber-400 transition-colors">Ranking ELO</Link>
                            </>
                        ) : (
                            <>
                                <Link href="/club" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors">Dashboard</Link>
                            </>
                        )}
                    </nav>

                    <div className="flex items-center gap-4 ml-auto">
                        {rolUsuario === "superadmin" && (
                            <div className="hidden lg:flex items-center gap-3 mr-4 border-r border-neutral-800 pr-4">
                                <Link href="/superadmin" className="text-xs font-semibold text-red-500 hover:text-red-400 border border-red-500/30 px-2 py-1 rounded bg-red-500/10">SuperAdmin</Link>
                            </div>
                        )}

                        <div className="flex flex-col text-right">
                            <span className="text-sm font-medium text-white line-clamp-1 max-w-[120px]">{nombreReal}</span>
                            {rolUsuario !== "admin_club" && (
                                <span className="text-xs text-green-400 font-semibold">1450 pts</span>
                            )}
                        </div>
                        <Link href={rolUsuario === "admin_club" ? "/club" : "/jugador/perfil"}>
                            <Avatar className="h-9 w-9 border border-neutral-800 hover:border-emerald-500/50 transition-colors cursor-pointer">
                                <AvatarFallback className="bg-neutral-800 text-neutral-300">{iniciales}</AvatarFallback>
                            </Avatar>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
                {children}
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="fixed bottom-0 w-full z-40 bg-neutral-950/90 backdrop-blur-lg border-t border-neutral-800 md:hidden pb-safe">
                <div className="flex justify-around items-center h-16">
                    {rolUsuario !== "admin_club" ? (
                        <>
                            <Link href="/jugador" className="flex flex-col items-center justify-center w-full h-full text-emerald-500">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Inicio</span>
                            </Link>
                            <Link href="/partidos" className="flex flex-col items-center justify-center w-full h-full text-neutral-400 hover:text-neutral-200 transition-colors">
                                <Calendar className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Partidos</span>
                            </Link>
                            <Link href="/ranking" className="flex flex-col items-center justify-center w-full h-full text-neutral-400 hover:text-neutral-200 transition-colors">
                                <Trophy className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Ranking</span>
                            </Link>
                            <Link href="/jugador/perfil" className="flex flex-col items-center justify-center w-full h-full text-neutral-400 hover:text-neutral-200 transition-colors">
                                <User className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Perfil</span>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link href="/club" className="flex flex-col items-center justify-center w-full h-full text-emerald-500">
                                <Home className="w-5 h-5 mb-1" />
                                <span className="text-[10px] font-medium">Dashboard</span>
                            </Link>
                        </>
                    )}
                </div>
            </nav>
        </div>
    )
}
