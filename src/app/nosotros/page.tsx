import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Grid2x2, Zap, Trophy, MessageCircle } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
    title: "Nosotros — Pádel Manía",
    description:
        "La plataforma para organizar torneos de pádel, llevar el ranking de tu club y que cada jugador sepa siempre contra quién juega y cómo va — en vivo, sin planillas.",
};

const FEATURES = [
    {
        num: "01",
        title: "Torneos completos",
        desc: "Liga, Relámpago y Copa Davis — grupos, cuadros de eliminación y clasificación, armados en minutos.",
    },
    {
        num: "02",
        title: "Ranking por club",
        desc: "Cada club lleva el nivel de sus jugadores; sube y baja solo con cada partido confirmado.",
    },
    {
        num: "03",
        title: "Resultados en vivo",
        desc: "Las parejas cargan su marcador, el club confirma, y la tabla se actualiza sola.",
    },
    {
        num: "04",
        title: "Muro del torneo",
        desc: "Reglas, fechas importantes y anuncios del club, visibles para todos los inscritos.",
    },
];

const FORMATS = [
    {
        icon: Grid2x2,
        title: "Liga",
        desc: "Grupos grandes a todos contra todos durante toda la temporada, luego fase final entre los mejores.",
    },
    {
        icon: Zap,
        title: "Relámpago",
        desc: "Torneo corto, grupos chicos y cuadro eliminatorio directo — de inscripción a campeón en un fin de semana.",
    },
    {
        icon: Trophy,
        title: "Copa Davis",
        desc: "Club contra club: serie de partidos por categoría, ida y vuelta, con marcador global entre las dos sedes.",
    },
];

const STATS = [
    { n: "5", l: "Torneos jugados" },
    { n: "228", l: "Partidos registrados" },
    { n: "130+", l: "Jugadores activos" },
    { n: "2", l: "Clubes en producción" },
];

const STEPS = [
    {
        idx: "Paso uno",
        title: "El club arma el torneo",
        desc: "Elige el formato, las categorías y abre inscripciones — sin planillas de Excel ni grupos de WhatsApp para coordinar.",
    },
    {
        idx: "Paso dos",
        title: "Las parejas se inscriben",
        desc: "Cada jugador entra con su cuenta, ve su grupo y sabe exactamente contra quién y cuándo le toca jugar.",
    },
    {
        idx: "Paso tres",
        title: "Todos siguen el resultado",
        desc: "Los marcadores se cargan desde la cancha; la tabla, el ranking y el cuadro se actualizan solos para todo el club.",
    },
];

const FAQS = [
    {
        q: "¿Cuánto cuesta usar Pádel Manía?",
        a: "Nada, por ahora. Mientras estamos en fase de pruebas, cualquier club puede organizar sus torneos sin costo. Cuando definamos el modelo de precios para el lanzamiento, los clubes que ya están con nosotros desde esta etapa tendrán condiciones preferenciales.",
    },
    {
        q: "¿Cómo hace mi club para empezar a usarla?",
        a: "Escríbenos por WhatsApp o correo, te creamos el acceso de administrador de tu club y te acompañamos a montar tu primer torneo — categorías, formato e inscripciones incluidos.",
    },
    {
        q: "¿Los jugadores necesitan instalar algo?",
        a: "No. Pádel Manía funciona desde el navegador del celular o el computador, sin descargar nada. Cada jugador entra con su cuenta y ve su grupo, sus partidos y el ranking del club.",
    },
    {
        q: "¿Qué formatos de torneo soporta?",
        a: "Hoy: Liga, Relámpago y Copa Davis club contra club. Son los tres formatos que ya hemos corrido con clubes reales — y seguimos sumando variantes a partir de lo que nos piden los propios clubes.",
    },
    {
        q: "¿Por qué dicen que está en fase MVP?",
        a: "Porque lo es: estamos construyendo la plataforma con clubes y jugadores reales jugando torneos reales, no en un laboratorio. Eso significa que todavía hay cosas por pulir — y que quien entra ahora tiene voz directa en qué se construye después, como notificaciones y reservas de cancha.",
    },
    {
        q: "Mi club no es de Manizales o Chinchiná, ¿igual podemos entrar?",
        a: "Sí. No importa la ciudad — estamos buscando activamente más clubes para sumar a esta primera etapa. Entre más clubes participen, más rápido crece la red de pádel en Colombia.",
    },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-display text-[13px] tracking-[0.22em] uppercase text-ochre-dark">
            {children}
        </p>
    );
}

export default function NosotrosPage() {
    return (
        <main className="bg-paper text-ink">
            {/* Nav */}
            <nav className="max-w-5xl mx-auto flex justify-between items-center px-7 py-6">
                <BrandLogo size="sm" />
                <Link
                    href="/"
                    className="text-sm font-bold uppercase tracking-widest text-olive hover:text-olive-dark transition-colors"
                >
                    Ir a la app
                </Link>
            </nav>

            {/* Hero */}
            <section className="max-w-5xl mx-auto px-7 pt-10 pb-16 text-center">
                <div className="w-[108px] h-[108px] rounded-full border-2 border-ochre bg-paper-soft flex items-center justify-center mx-auto mb-7 overflow-hidden">
                    <Image
                        src="/logo.png"
                        alt="Pádel Manía"
                        width={78}
                        height={78}
                        className="w-[78px] h-[78px] object-contain"
                        priority
                    />
                </div>
                <Eyebrow>Tu club · Tu juego · Tu ranking</Eyebrow>
                <h1 className="font-display text-[clamp(52px,9vw,96px)] leading-[0.95] tracking-[0.02em] my-3 text-balance">
                    Pádel Manía
                </h1>
                <p className="max-w-[560px] mx-auto mb-8 text-lg text-ink-soft leading-relaxed">
                    La plataforma para organizar torneos de pádel, llevar el ranking de tu club y que cada jugador sepa siempre contra quién juega y cómo va — en vivo, sin planillas.
                </p>
                <div className="flex gap-3.5 justify-center flex-wrap">
                    <a
                        href="https://padelmaniaapp.com"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-display text-base tracking-[0.08em] uppercase bg-olive text-paper hover:-translate-y-0.5 transition-transform"
                    >
                        Entrar a la app
                    </a>
                    <a
                        href="#comunidad"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-display text-base tracking-[0.08em] uppercase border-[1.5px] border-olive/20 text-ink hover:-translate-y-0.5 transition-transform"
                    >
                        Ser parte del MVP
                    </a>
                </div>
            </section>

            <hr className="border-t border-olive/20" />

            {/* Qué hacemos */}
            <section className="py-19 px-7">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-11">
                        <Eyebrow>Qué hacemos</Eyebrow>
                        <h2 className="font-display text-[clamp(36px,5vw,52px)] leading-[0.95] mt-1.5 text-balance">
                            Todo el torneo, en un solo lugar
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-olive/20 border border-olive/20">
                        {FEATURES.map((f) => (
                            <div key={f.num} className="bg-paper p-7">
                                <p className="font-display text-sm tracking-[0.1em] text-ochre-dark">{f.num}</p>
                                <h3 className="text-xl font-semibold mt-2.5 mb-2">{f.title}</h3>
                                <p className="text-ink-soft text-[14.5px] leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Clubes */}
            <section className="py-19 px-7 bg-paper-soft">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-11">
                        <Eyebrow>Ya lo estamos probando</Eyebrow>
                        <h2 className="font-display text-[clamp(36px,5vw,52px)] leading-[0.95] mt-1.5 text-balance">
                            Clubes en cancha
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6">
                        <div className="border border-ochre bg-paper-soft p-8">
                            <span className="inline-block font-display text-[11px] tracking-[0.15em] uppercase text-ochre-dark border border-ochre-soft rounded-full px-3 py-1 mb-4.5">
                                Club principal
                            </span>
                            <h3 className="font-display text-3xl mb-1.5">Padel del Río Manizales</h3>
                            <p className="text-ink-soft text-sm mb-5">Manizales, Caldas</p>
                            <div className="flex gap-2 flex-wrap">
                                {["Liga", "Relámpago", "Copa Davis"].map((t) => (
                                    <span key={t} className="text-[12.5px] font-semibold px-3 py-1.5 rounded-md bg-paper border border-olive/20">
                                        {t}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="border border-olive/20 bg-paper-soft p-8">
                            <span className="inline-block font-display text-[11px] tracking-[0.15em] uppercase text-ochre-dark border border-ochre-soft rounded-full px-3 py-1 mb-4.5">
                                Copa Davis
                            </span>
                            <h3 className="font-display text-3xl mb-1.5">Padel Club Chinchiná</h3>
                            <p className="text-ink-soft text-sm mb-5">Chinchiná, Caldas</p>
                            <div className="flex gap-2 flex-wrap">
                                <span className="text-[12.5px] font-semibold px-3 py-1.5 rounded-md bg-paper border border-olive/20">
                                    Copa Davis
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Formatos */}
            <section className="py-19 px-7">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-11">
                        <Eyebrow>Formatos</Eyebrow>
                        <h2 className="font-display text-[clamp(36px,5vw,52px)] leading-[0.95] mt-1.5 text-balance">
                            Tres maneras de competir
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {FORMATS.map((f) => (
                            <div key={f.title} className="p-6.5 border border-olive/20 bg-paper">
                                <f.icon className="w-[30px] h-[30px] mb-4 text-olive" strokeWidth={1.6} />
                                <h3 className="text-[21px] mb-2">{f.title}</h3>
                                <p className="text-ink-soft text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-19 px-7 bg-paper-soft">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-11">
                        <Eyebrow>Lo que llevamos</Eyebrow>
                        <h2 className="font-display text-[clamp(36px,5vw,52px)] leading-[0.95] mt-1.5 text-balance">
                            Números reales, no una demo
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 border border-olive/20">
                        {STATS.map((s, i) => (
                            <div
                                key={s.l}
                                className={`p-7.5 text-center ${i % 2 === 0 ? "border-r border-olive/20" : "md:border-r md:border-olive/20"} ${i === STATS.length - 1 ? "md:border-r-0" : ""}`}
                            >
                                <p className="font-display text-[46px] text-olive tabular-nums">{s.n}</p>
                                <p className="text-[12.5px] text-ink-soft uppercase tracking-[0.08em] mt-1">{s.l}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Gallery */}
            <section className="py-19 px-7">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-11">
                        <Eyebrow>Así se ve</Eyebrow>
                        <h2 className="font-display text-[clamp(36px,5vw,52px)] leading-[0.95] mt-1.5 text-balance">
                            Capturas de la app en uso
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4.5">
                        <div className="border border-olive/20 bg-paper-soft p-1.5 md:row-span-2">
                            <Image
                                src="/images/nosotros/shot-grupos.jpg"
                                alt="Tabla de posiciones de un grupo, con puntos, sets y games por pareja"
                                width={760}
                                height={720}
                                className="border border-olive/20 w-full h-auto"
                            />
                            <p className="text-[12.5px] text-ink-soft px-1.5 pt-2.5">
                                Tabla de posiciones en vivo, por grupo y categoría.
                            </p>
                        </div>
                        <div className="border border-olive/20 bg-paper-soft p-1.5">
                            <Image
                                src="/images/nosotros/shot-muro.jpg"
                                alt="Muro del torneo con reglas, fechas importantes y anuncios"
                                width={900}
                                height={500}
                                className="border border-olive/20 w-full h-auto"
                            />
                            <p className="text-[12.5px] text-ink-soft px-1.5 pt-2.5">
                                Muro del torneo: reglas, fechas y anuncios del club.
                            </p>
                        </div>
                        <div className="border border-olive/20 bg-paper-soft p-1.5">
                            <Image
                                src="/images/nosotros/shot-ranking.jpg"
                                alt="Ranking del club con nivel de cada jugador"
                                width={900}
                                height={400}
                                className="border border-olive/20 w-full h-auto"
                            />
                            <p className="text-[12.5px] text-ink-soft px-1.5 pt-2.5">
                                Ranking del club, jugador por jugador.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Cómo funciona */}
            <section className="py-19 px-7 bg-paper-soft">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-11">
                        <Eyebrow>Cómo funciona</Eyebrow>
                        <h2 className="font-display text-[clamp(36px,5vw,52px)] leading-[0.95] mt-1.5 text-balance">
                            De la inscripción al campeón
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
                        {STEPS.map((s) => (
                            <div key={s.idx} className="pt-2 border-t-2 border-olive">
                                <p className="font-display text-[13px] tracking-[0.15em] text-ochre-dark">{s.idx}</p>
                                <h3 className="text-[19px] my-2">{s.title}</h3>
                                <p className="text-ink-soft text-sm leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* MVP / comunidad */}
            <section id="comunidad" className="py-19 px-7">
                <div className="max-w-5xl mx-auto">
                    <div className="border-[1.5px] border-ochre p-10">
                        <Eyebrow>En construcción</Eyebrow>
                        <h2 className="font-display text-[clamp(30px,4.5vw,44px)] leading-[0.95] mt-2.5 mb-4 text-balance">
                            Estamos armando el MVP — a la vista de todos
                        </h2>
                        <p className="text-ink-soft leading-relaxed text-[15.5px] max-w-[680px] mb-3">
                            Pádel Manía todavía está en etapa de pruebas, desarrollo e investigación. Lo estamos construyendo con clubes reales jugando torneos reales, no en un laboratorio — cada partido que se juega nos dice qué falta ajustar antes del lanzamiento oficial.
                        </p>
                        <p className="text-ink-soft leading-relaxed text-[15.5px] max-w-[680px]">
                            Súmate ahora y no solo pruebas la app: ayudas a definir cómo va a ser la primera red de comunidades de pádel en Colombia, desde el día uno.
                        </p>
                        <div className="flex gap-3.5 flex-wrap mt-6">
                            {["Notificaciones", "Reservas de cancha desde la app"].map((t) => (
                                <span
                                    key={t}
                                    className="flex items-center gap-2 px-4.5 py-2.5 rounded-full border border-dashed border-ochre-soft text-[13.5px] font-semibold text-ochre-dark before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-ochre"
                                >
                                    Próximamente — {t}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="py-19 px-7 bg-paper-soft">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-11">
                        <Eyebrow>Preguntas frecuentes</Eyebrow>
                        <h2 className="font-display text-[clamp(36px,5vw,52px)] leading-[0.95] mt-1.5 text-balance">
                            Lo que suelen preguntarnos
                        </h2>
                    </div>
                    <div className="max-w-[720px]">
                        {FAQS.map((f, i) => (
                            <details
                                key={f.q}
                                open={i === 0}
                                className={`group border-b border-olive/20 ${i === 0 ? "border-t" : ""}`}
                            >
                                <summary className="list-none cursor-pointer py-5.5 px-1 flex items-center justify-between gap-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                                    {f.q}
                                    <span className="relative w-5.5 h-5.5 flex-none">
                                        <span className="absolute inset-0 m-auto w-3.5 h-[1.5px] bg-olive" />
                                        <span className="absolute inset-0 m-auto w-[1.5px] h-3.5 bg-olive transition-transform group-open:rotate-90 group-open:opacity-0" />
                                    </span>
                                </summary>
                                <p className="text-ink-soft text-[15px] leading-relaxed pb-6 pr-7 pl-1 max-w-[620px]">
                                    {f.a}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="max-w-5xl mx-auto px-7 py-22 text-center">
                <h2 className="font-display text-[clamp(38px,6vw,60px)] leading-[0.95] mb-4 text-balance">
                    ¿Tu club quiere ser el siguiente?
                </h2>
                <p className="text-ink-soft max-w-[480px] mx-auto mb-8 leading-relaxed">
                    Escríbenos y te mostramos cómo montar tu primer torneo — sin costo mientras estamos en fase de pruebas.
                </p>
                <div className="flex gap-3.5 justify-center flex-wrap">
                    <a
                        href="https://padelmaniaapp.com"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-display text-base tracking-[0.08em] uppercase bg-olive text-paper hover:-translate-y-0.5 transition-transform"
                    >
                        padelmaniaapp.com
                    </a>
                    <a
                        href="https://wa.me/573206368402?text=Hola%2C%20quiero%20unir%20mi%20club%20a%20P%C3%A1del%20Man%C3%ADa"
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-display text-base tracking-[0.08em] uppercase bg-[#3f5c33] text-paper hover:-translate-y-0.5 transition-transform"
                    >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                    </a>
                    <a
                        href="mailto:jdcanod@gmail.com"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-display text-base tracking-[0.08em] uppercase border-[1.5px] border-olive/20 text-ink hover:-translate-y-0.5 transition-transform"
                    >
                        Escríbenos
                    </a>
                </div>
            </section>

            <footer className="text-center text-[12.5px] text-ink-soft tracking-[0.04em] pb-10">
                Pádel Manía — Tu Club · Tu Juego · Tu Ranking
            </footer>
        </main>
    );
}
