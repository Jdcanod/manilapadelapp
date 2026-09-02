"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollText, CalendarClock, Megaphone, Plus, Pencil, Trash2, ArrowUp, ArrowDown, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    crearMuroPost, editarMuroPost, eliminarMuroPost, moverMuroPost,
    type MuroPost, type MuroTipo,
} from "@/app/(dashboard)/club/torneos/[id]/muro-actions";

const SECCIONES: { tipo: MuroTipo; titulo: string; icon: typeof ScrollText; ordenable: boolean; conFecha: boolean; placeholder: string }[] = [
    { tipo: 'regla', titulo: 'Reglas', icon: ScrollText, ordenable: true, conFecha: false, placeholder: 'Ej: Los partidos se juegan al mejor de 3 sets...' },
    { tipo: 'fecha_importante', titulo: 'Fechas Importantes', icon: CalendarClock, ordenable: true, conFecha: true, placeholder: 'Ej: Cierre de inscripciones' },
    { tipo: 'anuncio', titulo: 'Anuncios', icon: Megaphone, ordenable: false, conFecha: false, placeholder: 'Ej: Se reprograma la jornada del sábado...' },
];

interface Props {
    torneoId: string;
    posts: MuroPost[];
}

export function TorneoMuroManager({ torneoId, posts }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [creandoTipo, setCreandoTipo] = useState<MuroTipo | null>(null);
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [form, setForm] = useState({ titulo: "", contenido: "", fecha_evento: "" });

    const resetForm = () => {
        setForm({ titulo: "", contenido: "", fecha_evento: "" });
        setCreandoTipo(null);
        setEditandoId(null);
        setError(null);
    };

    const startEdit = (post: MuroPost) => {
        setEditandoId(post.id);
        setCreandoTipo(null);
        setForm({
            titulo: post.titulo,
            contenido: post.contenido || "",
            fecha_evento: post.fecha_evento ? post.fecha_evento.slice(0, 10) : "",
        });
    };

    const handleGuardar = (tipo: MuroTipo) => {
        if (!form.titulo.trim()) { setError("El título es obligatorio"); return; }
        setError(null);
        startTransition(async () => {
            const res = editandoId
                ? await editarMuroPost(torneoId, editandoId, { titulo: form.titulo, contenido: form.contenido, fecha_evento: form.fecha_evento || null })
                : await crearMuroPost(torneoId, { tipo, titulo: form.titulo, contenido: form.contenido, fecha_evento: form.fecha_evento || null });
            if (!res.success) { setError(res.error || "Error al guardar"); return; }
            resetForm();
            router.refresh();
        });
    };

    const handleEliminar = (postId: string) => {
        if (!confirm("¿Eliminar esta publicación del muro?")) return;
        startTransition(async () => {
            const res = await eliminarMuroPost(torneoId, postId);
            if (!res.success) { alert(res.error || "Error al eliminar"); return; }
            router.refresh();
        });
    };

    const handleMover = (postId: string, direccion: 'up' | 'down') => {
        startTransition(async () => {
            const res = await moverMuroPost(torneoId, postId, direccion);
            if (!res.success) { alert(res.error || "Error al mover"); return; }
            router.refresh();
        });
    };

    return (
        <div className="space-y-8">
            <p className="text-xs text-olive/70">
                Lo que publiques aquí lo ven todas las parejas inscritas en este torneo, en la pestaña &quot;Muro&quot; de su vista.
            </p>

            {SECCIONES.map(seccion => {
                const items = posts.filter(p => p.tipo === seccion.tipo);
                const Icon = seccion.icon;
                const formVisible = creandoTipo === seccion.tipo || (editandoId && items.some(i => i.id === editandoId));

                return (
                    <div key={seccion.tipo} className="bg-paper-soft border border-olive/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-olive uppercase tracking-widest flex items-center gap-2">
                                <Icon className="w-4 h-4" /> {seccion.titulo}
                            </h3>
                            {creandoTipo !== seccion.tipo && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { resetForm(); setCreandoTipo(seccion.tipo); }}
                                    className="bg-paper border-olive/20 text-olive hover:text-ink"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Añadir
                                </Button>
                            )}
                        </div>

                        {items.length === 0 && !formVisible && (
                            <p className="text-xs text-olive/50 italic">Nada publicado todavía.</p>
                        )}

                        <div className="space-y-2">
                            {items.map((post, idx) => (
                                editandoId === post.id ? (
                                    <MuroForm
                                        key={post.id}
                                        seccion={seccion}
                                        form={form}
                                        setForm={setForm}
                                        error={error}
                                        isPending={isPending}
                                        onCancel={resetForm}
                                        onGuardar={() => handleGuardar(seccion.tipo)}
                                    />
                                ) : (
                                    <div key={post.id} className="bg-paper border border-olive/15 rounded-lg p-3 flex items-start gap-2">
                                        {seccion.ordenable && (
                                            <div className="flex flex-col -my-1 mt-0.5">
                                                <button type="button" onClick={() => handleMover(post.id, 'up')} disabled={idx === 0 || isPending} className={cn("p-0.5", idx === 0 ? "text-olive/15 cursor-not-allowed" : "text-olive/60 hover:text-olive")}>
                                                    <ArrowUp className="w-3 h-3" />
                                                </button>
                                                <button type="button" onClick={() => handleMover(post.id, 'down')} disabled={idx === items.length - 1 || isPending} className={cn("p-0.5", idx === items.length - 1 ? "text-olive/15 cursor-not-allowed" : "text-olive/60 hover:text-olive")}>
                                                    <ArrowDown className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-ink">{post.titulo}</p>
                                                {seccion.conFecha && post.fecha_evento && (
                                                    <span className="text-[10px] font-black uppercase text-ochre-dark bg-ochre/10 border border-ochre/30 rounded px-1.5 py-0.5">
                                                        {new Date(post.fecha_evento).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                                    </span>
                                                )}
                                            </div>
                                            {post.contenido && <p className="text-xs text-olive/80 mt-1 whitespace-pre-wrap">{post.contenido}</p>}
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button type="button" onClick={() => startEdit(post)} disabled={isPending} className="p-1.5 text-olive/60 hover:text-ink rounded">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button type="button" onClick={() => handleEliminar(post.id)} disabled={isPending} className="p-1.5 text-olive/60 hover:text-red-600 rounded">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            ))}

                            {creandoTipo === seccion.tipo && (
                                <MuroForm
                                    seccion={seccion}
                                    form={form}
                                    setForm={setForm}
                                    error={error}
                                    isPending={isPending}
                                    onCancel={resetForm}
                                    onGuardar={() => handleGuardar(seccion.tipo)}
                                />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function MuroForm({
    seccion, form, setForm, error, isPending, onCancel, onGuardar,
}: {
    seccion: typeof SECCIONES[number];
    form: { titulo: string; contenido: string; fecha_evento: string };
    setForm: (f: { titulo: string; contenido: string; fecha_evento: string }) => void;
    error: string | null;
    isPending: boolean;
    onCancel: () => void;
    onGuardar: () => void;
}) {
    return (
        <div className="bg-paper border border-ochre/30 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Input
                    placeholder="Título"
                    value={form.titulo}
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                    className="bg-paper-soft border-olive/20 text-ink"
                    autoFocus
                />
                <button type="button" onClick={onCancel} className="text-olive/60 hover:text-ink flex-shrink-0">
                    <X className="w-4 h-4" />
                </button>
            </div>
            {seccion.conFecha && (
                <Input
                    type="date"
                    value={form.fecha_evento}
                    onChange={(e) => setForm({ ...form, fecha_evento: e.target.value })}
                    className="bg-paper-soft border-olive/20 text-ink"
                />
            )}
            <Textarea
                placeholder={seccion.placeholder}
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                className="bg-paper-soft border-olive/20 text-ink min-h-[70px]"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button
                type="button"
                size="sm"
                onClick={onGuardar}
                disabled={isPending}
                className="bg-olive hover:bg-olive text-paper font-bold"
            >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Guardar
            </Button>
        </div>
    );
}
