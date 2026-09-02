import { ScrollText, CalendarClock, Megaphone } from "lucide-react";
import type { MuroPost } from "@/app/(dashboard)/club/torneos/[id]/muro-actions";

interface Props {
    posts: MuroPost[];
}

/** Vista de solo lectura del muro del torneo, para el jugador. */
export function TorneoMuroView({ posts }: Props) {
    const reglas = posts.filter(p => p.tipo === 'regla');
    const fechas = posts.filter(p => p.tipo === 'fecha_importante');
    const anuncios = posts
        .filter(p => p.tipo === 'anuncio')
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (reglas.length === 0 && fechas.length === 0 && anuncios.length === 0) {
        return (
            <div className="text-center py-16 bg-paper-soft/30 border-2 border-dashed border-olive/15 rounded-3xl">
                <ScrollText className="w-10 h-10 text-olive/30 mx-auto mb-3" />
                <p className="text-olive/70 font-bold uppercase tracking-widest text-sm">El club aún no ha publicado nada en el muro.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {reglas.length > 0 && (
                <div className="bg-paper-soft/50 border border-olive/15 rounded-2xl p-5">
                    <h3 className="text-sm font-black text-olive uppercase tracking-widest flex items-center gap-2 mb-3">
                        <ScrollText className="w-4 h-4" /> Reglas
                    </h3>
                    <ol className="space-y-2 list-decimal list-inside">
                        {reglas.map(r => (
                            <li key={r.id} className="text-sm text-ink">
                                <span className="font-bold">{r.titulo}</span>
                                {r.contenido && <p className="text-xs text-olive/80 mt-0.5 ml-5 whitespace-pre-wrap">{r.contenido}</p>}
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {fechas.length > 0 && (
                <div className="bg-paper-soft/50 border border-olive/15 rounded-2xl p-5">
                    <h3 className="text-sm font-black text-olive uppercase tracking-widest flex items-center gap-2 mb-3">
                        <CalendarClock className="w-4 h-4" /> Fechas Importantes
                    </h3>
                    <div className="space-y-2">
                        {fechas.map(f => (
                            <div key={f.id} className="flex items-start gap-3 bg-paper/60 border border-olive/10 rounded-lg px-3 py-2">
                                {f.fecha_evento && (
                                    <span className="text-[10px] font-black uppercase text-ochre-dark bg-ochre/10 border border-ochre/30 rounded px-1.5 py-1 flex-shrink-0 whitespace-nowrap">
                                        {new Date(f.fecha_evento).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                    </span>
                                )}
                                <div>
                                    <p className="text-sm font-bold text-ink">{f.titulo}</p>
                                    {f.contenido && <p className="text-xs text-olive/80 mt-0.5 whitespace-pre-wrap">{f.contenido}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {anuncios.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-black text-olive uppercase tracking-widest flex items-center gap-2">
                        <Megaphone className="w-4 h-4" /> Anuncios
                    </h3>
                    {anuncios.map(a => (
                        <div key={a.id} className="bg-paper border border-olive/15 rounded-2xl p-4">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-bold text-ink">{a.titulo}</p>
                                <span className="text-[10px] text-olive/60 flex-shrink-0">
                                    {new Date(a.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            {a.contenido && <p className="text-xs text-olive/80 whitespace-pre-wrap">{a.contenido}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
