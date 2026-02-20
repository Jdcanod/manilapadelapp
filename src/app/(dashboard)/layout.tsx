import Link from "next/link";
import { Trophy, Home, User, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
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
                        <Link href="/jugador" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Jugador</Link>
                        <Link href="/partidos" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Partidos</Link>
                        <Link href="/clubes" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Mapa Clubes</Link>
                        <Link href="/ranking" className="text-sm font-medium text-amber-500/80 hover:text-amber-400 transition-colors">Ranking ELO</Link>
                    </nav>

                    <div className="flex items-center gap-4 ml-auto">
                        <div className="hidden lg:flex items-center gap-3 mr-4 border-r border-neutral-800 pr-4">
                            <Link href="/club" className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded bg-emerald-500/10">Admin Club</Link>
                            <Link href="/superadmin" className="text-xs font-semibold text-red-500 hover:text-red-400 border border-red-500/30 px-2 py-1 rounded bg-red-500/10">SuperAdmin</Link>
                        </div>

                        <div className="flex flex-col text-right">
                            <span className="text-sm font-medium text-white">Andrés</span>
                            <span className="text-xs text-green-400 font-semibold">1450 pts</span>
                        </div>
                        <Avatar className="h-9 w-9 border border-neutral-800">
                            <AvatarImage src="https://ui.shadcn.com/avatars/02.png" alt="@andres" />
                            <AvatarFallback className="bg-neutral-800 text-neutral-300">AN</AvatarFallback>
                        </Avatar>
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
                </div>
            </nav>
        </div>
    )
}
