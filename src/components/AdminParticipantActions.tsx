"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { darDeBajaPareja, actualizarEstadoPago, editarParticipantesInscripcion, obtenerTodosJugadores, retirarParejaDelTorneo, reincorporarPareja, marcarExcusaPareja } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Trash2, Edit2, CreditCard, UserPlus, AlertCircle, LogOut, Undo2, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlayerNameFull, isGuestEmail } from "@/lib/display-names";

interface User {
    id: string;
    nombre: string;
    apellido?: string | null;
    email: string;
    esInvitado?: boolean;
    esDelClub?: boolean;
}

interface AdminParticipantActionsProps {
    id: string;
    parejaId: string;
    tipo: 'master' | 'regular';
    torneoId: string;
    hasStarted: boolean;
    j1Id?: string;
    j2Id?: string;
    estadoPago?: string;
    /** La pareja se retiró: conserva lo jugado pero ya no clasifica. */
    retirada?: boolean;
    /** Tiene excusa: el corte no la saca (pero sigue necesitando el mínimo). */
    excusa?: boolean;
    excusaMotivo?: string | null;
}

export function AdminParticipantActions({ id, parejaId, tipo, torneoId, hasStarted, j1Id, j2Id, estadoPago, retirada, excusa, excusaMotivo }: AdminParticipantActionsProps) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [editOpen, setEditOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);

    // Estado para edición
    const [selectedJ1, setSelectedJ1] = useState(j1Id || "");
    const [selectedJ2, setSelectedJ2] = useState(j2Id || "");
    const [j1Manual, setJ1Manual] = useState(false);
    const [j2Manual, setJ2Manual] = useState(false);
    const [j1Name, setJ1Name] = useState("");
    const [j2Name, setJ2Name] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Por defecto solo jugadores REALES (no invitados) del club dueño del
    // torneo. Se pueden desactivar para buscar invitados u otros clubes.
    const [soloClub, setSoloClub] = useState(true);
    const [incluirInvitados, setIncluirInvitados] = useState(false);

    useEffect(() => {
        if (editOpen && allUsers.length === 0) {
            obtenerTodosJugadores(torneoId).then(setAllUsers);
        }
    }, [editOpen, allUsers.length, torneoId]);

    const usersParaSeleccionar = allUsers.filter(u => {
        if (!incluirInvitados && u.esInvitado) return false;
        if (soloClub && !u.esDelClub) return false;
        return true;
    });

    const handleTogglePago = () => {
        const nuevoEstado = estadoPago === 'pagado' ? 'pendiente' : 'pagado';
        startTransition(async () => {
            try {
                await actualizarEstadoPago(id, tipo, nuevoEstado, torneoId);
                router.refresh();
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al cambiar estado de pago");
            }
        });
    };

    const handleEditParticipants = () => {
        const finalJ1 = j1Manual ? `manual:${j1Name.trim()}` : selectedJ1;
        const finalJ2 = j2Manual ? `manual:${j2Name.trim()}` : selectedJ2;

        if (!finalJ1 || !finalJ2) {
            setError("Debes seleccionar ambos jugadores");
            return;
        }
        if (finalJ1 === finalJ2 && !j1Manual && !j2Manual) {
            setError("Los jugadores deben ser distintos");
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                const res = await editarParticipantesInscripcion(id, tipo, parejaId, finalJ1, finalJ2, torneoId);
                if (res.success) {
                    setEditOpen(false);
                    router.refresh();
                } else {
                    setError(res.message || "Error al editar integrantes");
                }
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Error al editar integrantes");
            }
        });
    };

    /**
     * Excusa frente al corte: el club justifica por qué esta pareja no llegó
     * al mínimo. La salva del corte, NO de clasificar.
     */
    const handleExcusa = () => {
        if (excusa) {
            if (!confirm("¿Quitar la excusa? La pareja vuelve a entrar al corte por participación.")) return;
            startTransition(async () => {
                const r = await marcarExcusaPareja(torneoId, parejaId, false);
                if (r.ok) router.refresh();
                else alert("No se pudo quitar la excusa: " + r.mensaje);
            });
            return;
        }

        const motivo = prompt([
            "¿Por qué no pudo jugar? (lo ve el club, así la excepción no parece favoritismo)",
            "",
            "La excusa evita que el corte la saque, y conserva sus partidos pendientes para que pueda alcanzar el mínimo.",
            "Si al final no lo alcanza, igual no clasifica.",
        ].join("\n"));

        if (motivo === null) return;

        startTransition(async () => {
            const r = await marcarExcusaPareja(torneoId, parejaId, true, motivo);
            if (r.ok) router.refresh();
            else alert(r.mensaje);
        });
    };

    /**
     * Retiro: para una pareja que YA jugó y no sigue. Distinto de la papelera,
     * que borra la inscripción entera y sirve para una inscripción equivocada.
     */
    const handleRetirar = () => {
        const aviso = [
            "¿Retirar a esta pareja del torneo?",
            "",
            "· Los partidos que ya jugó SE MANTIENEN, con sus resultados.",
            "· Sus partidos pendientes se cancelan.",
            "· A sus rivales les baja lo que se les exige jugar, así que no los perjudica.",
            "· La pareja queda en la tabla, marcada, y no clasifica a la fase final.",
        ].join("\n");
        if (!confirm(aviso)) return;

        startTransition(async () => {
            const r = await retirarParejaDelTorneo(torneoId, parejaId);
            if (r.ok) router.refresh();
            else alert("No se pudo retirar: " + r.mensaje);
        });
    };

    const handleReincorporar = () => {
        if (!confirm("¿Reincorporar a esta pareja?\n\nOjo: los partidos que se cancelaron NO vuelven solos, hay que generarlos de nuevo desde el sorteo.")) return;
        startTransition(async () => {
            const r = await reincorporarPareja(torneoId, parejaId);
            if (r.ok) router.refresh();
            else alert("No se pudo reincorporar: " + r.mensaje);
        });
    };

    const handleEliminar = () => {
        const msg = hasStarted 
            ? "El torneo ya inició. Al dar de baja a esta pareja, se ELIMINARÁN todos sus partidos PENDIENTES. Los partidos ya jugados se mantendrán. ¿Deseas continuar?"
            : "¿Seguro que deseas eliminar esta inscripción del torneo?";
            
        if (!confirm(msg)) return;
        
        startTransition(async () => {
            try {
                await darDeBajaPareja(id, tipo, parejaId, torneoId);
                router.refresh();
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al eliminar");
            }
        });
    };

    return (
        <div className="flex gap-2 justify-end items-center">
            {/* BOTÓN PAGO */}
            <Button
                variant="ghost"
                size="sm"
                onClick={handleTogglePago}
                disabled={isPending}
                className={cn(
                    "h-8 px-2 text-[10px] font-black uppercase tracking-widest gap-1.5 rounded-lg border transition-all",
                    estadoPago === 'pagado' 
                        ? "text-olive border-olive/20 bg-olive/5 hover:bg-olive/10" 
                        : "text-ochre-dark border-ochre/20 bg-ochre/5 hover:bg-ochre/10"
                )}
            >
                <CreditCard className="w-3 h-3" />
                {estadoPago === 'pagado' ? "Pagado" : "Pendiente"}
            </Button>

            {/* MODAL EDITAR JUGADORES */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-olive/20 bg-paper-soft text-olive hover:text-ink hover:bg-paper-dark rounded-lg"
                    >
                        <Edit2 className="w-3 h-3" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="bg-paper border-olive/15 text-ink max-w-md rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black italic uppercase tracking-widest text-ochre-dark flex items-center gap-2">
                            <UserPlus className="w-5 h-5" /> Editar Integrantes
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                        <div className="p-4 bg-ochre/5 border border-ochre/10 rounded-2xl">
                            <p className="text-[10px] text-ochre-dark font-bold uppercase tracking-widest leading-relaxed">
                                Nota: Esto actualizará los nombres en todos los partidos (grupos y eliminatorias) donde participa esta pareja sin alterar el cronograma.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5 px-1">
                            <label className="flex items-center gap-2 text-[10px] text-olive/70 cursor-pointer hover:text-ink transition-colors">
                                <input type="checkbox" checked={soloClub} onChange={(e) => setSoloClub(e.target.checked)} className="rounded border-olive/20 bg-paper-soft text-olive focus:ring-olive" />
                                Solo jugadores de este club (desmarca para buscar en todos los clubes)
                            </label>
                            <label className="flex items-center gap-2 text-[10px] text-olive/70 cursor-pointer hover:text-ink transition-colors">
                                <input type="checkbox" checked={incluirInvitados} onChange={(e) => setIncluirInvitados(e.target.checked)} className="rounded border-olive/20 bg-paper-soft text-olive focus:ring-olive" />
                                Incluir invitados existentes en la lista
                            </label>
                        </div>

                        <div className="space-y-4">
                            {/* Jugador 1 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest ml-1">Jugador 1</label>
                                    <label className="flex items-center gap-2 text-[10px] text-olive/70 cursor-pointer hover:text-ochre-dark transition-colors">
                                        <input type="checkbox" checked={j1Manual} onChange={(e) => setJ1Manual(e.target.checked)} className="rounded border-olive/20 bg-paper-soft text-ochre-dark focus:ring-amber-500" />
                                        Invitado
                                    </label>
                                </div>
                                {j1Manual ? (
                                    <Input 
                                        placeholder="Nombre completo" 
                                        value={j1Name} 
                                        onChange={(e) => setJ1Name(e.target.value)} 
                                        className="bg-paper-soft border-olive/20 h-12 rounded-xl"
                                    />
                                ) : (
                                    <Select value={selectedJ1} onValueChange={setSelectedJ1}>
                                        <SelectTrigger className="bg-paper-soft border-olive/20 h-12 rounded-xl">
                                            <SelectValue placeholder="Seleccionar jugador" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[300px]">
                                            {usersParaSeleccionar.map(u => {
                                                const inv = isGuestEmail(u.email);
                                                return (
                                                    <SelectItem key={u.id} value={u.id} className="focus:bg-ochre/10 focus:text-ochre-dark">
                                                        <span className="inline-flex items-center gap-2">
                                                            <span className={inv ? "text-ochre-soft" : ""}>
                                                                {formatPlayerNameFull({ nombre: u.nombre, apellido: u.apellido, email: u.email })}
                                                            </span>
                                                            {!inv && (
                                                                <span className="text-[10px] text-olive/70 italic">{u.email}</span>
                                                            )}
                                                        </span>
                                                    </SelectItem>
                                                );
                                            })}
                                            {usersParaSeleccionar.length === 0 && (
                                                <SelectItem value="disabled" disabled>
                                                    {allUsers.length === 0 ? "Cargando jugadores..." : "Sin resultados — prueba quitando alguno de los filtros de arriba"}
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Jugador 2 */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest ml-1">Jugador 2</label>
                                    <label className="flex items-center gap-2 text-[10px] text-olive/70 cursor-pointer hover:text-ochre-dark transition-colors">
                                        <input type="checkbox" checked={j2Manual} onChange={(e) => setJ2Manual(e.target.checked)} className="rounded border-olive/20 bg-paper-soft text-ochre-dark focus:ring-amber-500" />
                                        Invitado
                                    </label>
                                </div>
                                {j2Manual ? (
                                    <Input 
                                        placeholder="Nombre completo" 
                                        value={j2Name} 
                                        onChange={(e) => setJ2Name(e.target.value)} 
                                        className="bg-paper-soft border-olive/20 h-12 rounded-xl"
                                    />
                                ) : (
                                    <Select value={selectedJ2} onValueChange={setSelectedJ2}>
                                        <SelectTrigger className="bg-paper-soft border-olive/20 h-12 rounded-xl">
                                            <SelectValue placeholder="Seleccionar jugador" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[300px]">
                                            {usersParaSeleccionar.map(u => {
                                                const inv = isGuestEmail(u.email);
                                                return (
                                                    <SelectItem key={u.id} value={u.id} className="focus:bg-ochre/10 focus:text-ochre-dark">
                                                        <span className="inline-flex items-center gap-2">
                                                            <span className={inv ? "text-ochre-soft" : ""}>
                                                                {formatPlayerNameFull({ nombre: u.nombre, apellido: u.apellido, email: u.email })}
                                                            </span>
                                                            {!inv && (
                                                                <span className="text-[10px] text-olive/70 italic">{u.email}</span>
                                                            )}
                                                        </span>
                                                    </SelectItem>
                                                );
                                            })}
                                            {usersParaSeleccionar.length === 0 && (
                                                <SelectItem value="disabled" disabled>
                                                    {allUsers.length === 0 ? "Cargando jugadores..." : "Sin resultados — prueba quitando alguno de los filtros de arriba"}
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <span className="text-red-500 text-xs font-bold">{error}</span>
                            </div>
                        )}

                        <Button 
                            className="w-full bg-ochre-dark hover:bg-ochre h-12 rounded-xl font-black uppercase tracking-widest text-xs" 
                            onClick={handleEditParticipants}
                            disabled={isPending}
                        >
                            {isPending ? "Guardando..." : "Confirmar Cambios"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* EXCUSA PARA EL CORTE */}
            {hasStarted && (
                <Button
                    variant="ghost" size="sm" onClick={handleExcusa} disabled={isPending}
                    title={excusa
                        ? `Con excusa: ${excusaMotivo || 'sin motivo'} — click para quitarla`
                        : "Excusar del corte por participación (no la exime de clasificar)"}
                    className={cn(
                        "h-8 w-8 p-0 rounded-lg transition-colors",
                        excusa
                            ? "text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20"
                            : "text-olive/50 hover:text-emerald-700 hover:bg-emerald-500/10"
                    )}
                >
                    <HeartPulse className="w-3 h-3" />
                </Button>
            )}

            {/* RETIRAR / REINCORPORAR — sólo tiene sentido con el torneo andando */}
            {hasStarted && (
                retirada ? (
                    <Button
                        variant="ghost" size="sm" onClick={handleReincorporar} disabled={isPending}
                        title="Reincorporar al torneo"
                        className="h-8 w-8 p-0 text-olive/50 hover:text-olive hover:bg-olive/10 rounded-lg transition-colors"
                    >
                        <Undo2 className="w-3 h-3" />
                    </Button>
                ) : (
                    <Button
                        variant="ghost" size="sm" onClick={handleRetirar} disabled={isPending}
                        title="Retirar del torneo (conserva lo jugado)"
                        className="h-8 w-8 p-0 text-olive/50 hover:text-ochre-dark hover:bg-ochre/10 rounded-lg transition-colors"
                    >
                        <LogOut className="w-3 h-3" />
                    </Button>
                )
            )}

            {/* BOTÓN ELIMINAR */}
            <Button
                variant="ghost"
                size="sm"
                onClick={handleEliminar}
                disabled={isPending}
                className="h-8 w-8 p-0 text-olive/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
            >
                <Trash2 className="w-3 h-3" />
            </Button>
        </div>
    );
}
