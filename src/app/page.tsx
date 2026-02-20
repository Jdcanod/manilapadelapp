import Link from "next/link";
import { Trophy, MapPin, CalendarDays, Users, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-neutral-950 via-green-950/20 to-blue-950/30">

      {/* Background Blobs for Glassmorphism Effect */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] mix-blend-screen pointer-events-none" />

      {/* Header/Nav */}
      <nav className="absolute top-0 w-full flex justify-between items-center p-6 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">ManilaPadel</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-5 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors">
            Iniciar Sesión
          </Link>
          <Link href="/registro" className="px-5 py-2 text-sm font-medium text-neutral-900 bg-white rounded-full hover:bg-neutral-200 transition-all shadow-lg hover:shadow-white/20 active:scale-95">
            Únete a la Comunidad
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-4xl px-4 mt-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-800/50 border border-neutral-700/50 backdrop-blur-md mb-8">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs font-medium text-neutral-300 uppercase tracking-widest">La primera app de pádel en Manizales</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-neutral-200 to-neutral-500 mb-6 drop-shadow-sm">
          Eleva tu nivel,<br /> domina la cancha.
        </h1>

        <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed font-light">
          Encuentra parejas de tu nivel, reserva en los mejores clubes de Manizales y compite en el ranking más vibrante de la ciudad. Sin excusas, puro pádel.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Link href="/partidos" className="group flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-full font-semibold shadow-xl shadow-green-600/20 hover:shadow-green-600/40 transition-all hover:-translate-y-1 active:scale-95">
            Explorar Partidos
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link href="/ranking" className="flex items-center justify-center gap-2 px-8 py-4 bg-neutral-900/50 border border-neutral-800 text-white rounded-full font-medium backdrop-blur-md hover:bg-neutral-800/80 transition-all hover:-translate-y-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            Ver Ranking de Parejas
          </Link>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl px-6 mt-24 pb-20">
        {[
          { icon: Users, title: "Ranking Dinámico ELO", desc: "Supera a parejas con mejor ranking y escala más rápido. Sistema justo y competitivo.", color: "text-blue-400" },
          { icon: MapPin, title: "Clubes en tu zona", desc: "Mapa interactivo de canchas panorámicas y techadas en todo Manizales.", color: "text-emerald-400" },
          { icon: CalendarDays, title: "Reservas Ágiles", desc: "Consigue el turno perfecto directamente desde tu celular. Confirmaciones vía WhatsApp.", color: "text-purple-400" }
        ].map((feat, i) => (
          <div key={i} className="group p-6 rounded-2xl bg-gradient-to-b from-neutral-900/80 to-neutral-900/30 border border-neutral-800/50 backdrop-blur-xl hover:bg-neutral-800/50 transition-all cursor-default">
            <feat.icon className={`w-10 h-10 ${feat.color} mb-4 opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all`} />
            <h3 className="text-xl font-semibold text-neutral-100 mb-2">{feat.title}</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>

    </main>
  );
}
