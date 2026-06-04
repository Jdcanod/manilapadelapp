import Link from "next/link";
import Image from "next/image";
import { Trophy, MapPin, CalendarDays, Users, ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function Home() {
    return (
        <main className="relative min-h-screen overflow-hidden bg-paper text-ink">
            {/* Textura sutil de papel */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.05]"
                style={{
                    backgroundImage:
                        "radial-gradient(circle at 20% 30%, rgba(94,97,24,0.4), transparent 40%), radial-gradient(circle at 80% 70%, rgba(168,138,75,0.3), transparent 40%)",
                }}
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(42,42,10,0.4) 2px, rgba(42,42,10,0.4) 3px)",
                    mixBlendMode: "multiply",
                }}
            />

            {/* Header / nav */}
            <nav className="relative z-10 max-w-7xl mx-auto flex justify-between items-center px-6 py-6">
                <BrandLogo size="md" />
                <div className="flex items-center gap-2 sm:gap-4">
                    <Link
                        href="/login"
                        className="px-4 sm:px-5 py-2 text-sm font-bold uppercase tracking-widest text-olive hover:text-olive-dark transition-colors"
                    >
                        Iniciar Sesión
                    </Link>
                    <Link
                        href="/registro"
                        className="px-5 py-2 text-sm font-black uppercase tracking-widest text-paper bg-olive rounded-full hover:bg-olive-dark transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                        Únete
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 pb-24 flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full bg-olive/10 border border-olive/20">
                    <span className="flex h-2 w-2 rounded-full bg-ochre animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-olive">
                        Comunidad de pádel
                    </span>
                </div>

                {/* Logo grande como sello central */}
                <div className="mb-8 relative">
                    <div className="w-40 h-40 sm:w-56 sm:h-56 rounded-full overflow-hidden shadow-xl ring-4 ring-paper-soft">
                        <Image
                            src="/logo.png"
                            alt="Pádel Manía"
                            width={288}
                            height={288}
                            className="w-full h-full object-cover"
                            priority
                        />
                    </div>
                </div>

                <h1 className="font-display text-5xl sm:text-7xl md:text-8xl tracking-[0.04em] text-olive mb-6 leading-[0.95]">
                    Eleva tu juego.
                    <br />
                    <span className="text-ochre">Domina la cancha.</span>
                </h1>

                <p className="font-sans text-base sm:text-lg md:text-xl text-ink-soft max-w-2xl mb-10 leading-relaxed">
                    Encuentra parejas de tu nivel, gestiona tu club, organiza torneos y compite en el ranking de tu ciudad. Sin excusas, puro pádel.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    <Link
                        href="/partidos"
                        className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-olive text-paper rounded-full font-bold uppercase tracking-widest text-sm shadow-lg hover:bg-olive-dark hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        Explorar Partidos
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                        href="/ranking"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-paper border-2 border-ochre/40 text-olive-dark rounded-full font-bold uppercase tracking-widest text-sm hover:bg-paper-soft hover:-translate-y-0.5 transition-all"
                    >
                        <Trophy className="w-4 h-4 text-ochre" />
                        Ver Ranking
                    </Link>
                </div>
            </section>

            {/* Features */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    {
                        icon: Users,
                        title: "Ranking ELO Dinámico",
                        desc: "Tu nivel se ajusta partido a partido. Sube más rápido ganándole a parejas mejores.",
                    },
                    {
                        icon: MapPin,
                        title: "Clubes en tu zona",
                        desc: "Lista interactiva de canchas panorámicas y techadas en tu ciudad.",
                    },
                    {
                        icon: CalendarDays,
                        title: "Torneos sin caos",
                        desc: "Grupos, brackets, scores y resultados. Todo organizado en un panel.",
                    },
                ].map((feat, i) => (
                    <div
                        key={i}
                        className="group p-6 rounded-2xl bg-paper-soft/80 border border-olive/15 hover:border-ochre/40 transition-all hover:shadow-md"
                    >
                        <div className="w-12 h-12 rounded-full bg-olive/10 border border-olive/20 flex items-center justify-center mb-4 group-hover:bg-ochre/15 group-hover:border-ochre/30 transition-colors">
                            <feat.icon className="w-5 h-5 text-olive group-hover:text-ochre-dark transition-colors" />
                        </div>
                        <h3 className="font-display tracking-widest text-xl text-olive uppercase mb-2">
                            {feat.title}
                        </h3>
                        <p className="text-ink-soft text-sm leading-relaxed">{feat.desc}</p>
                    </div>
                ))}
            </section>

            {/* Footer slogan tipo sello */}
            <footer className="relative z-10 max-w-6xl mx-auto px-6 pb-12 text-center">
                <p className="font-display tracking-[0.4em] text-ochre text-sm uppercase">
                    Tu Club &middot; Tu Juego &middot; Tu Ranking
                </p>
                <p className="font-display tracking-[0.3em] text-olive/60 text-xs uppercase mt-2">
                    Est. 2025
                </p>
            </footer>
        </main>
    );
}
