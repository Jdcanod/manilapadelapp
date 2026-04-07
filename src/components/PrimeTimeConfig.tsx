"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Edit2, Clock } from "lucide-react";

export interface HorarioPrimeRange {
    id: string;
    cancha: string;
    hora_inicio: string;
    hora_fin: string;
    fecha_inicio: string;
    fecha_fin: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PrimeTimeConfig({ initialRanges = [] }: { initialRanges: any }) {
    // Parse initial rules safely
    const [ranges, setRanges] = useState<HorarioPrimeRange[]>(() => {
        if (Array.isArray(initialRanges) && initialRanges.length > 0 && typeof initialRanges[0] === 'object') {
            return initialRanges as HorarioPrimeRange[];
        }
        return [];
    });

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [cancha, setCancha] = useState("all");
    const [horaInicio, setHoraInicio] = useState("17:00");
    const [horaFin, setHoraFin] = useState("22:00");
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFin, setFechaFin] = useState("");

    const openCreate = () => {
        setEditingId(null);
        setCancha("all");
        setHoraInicio("17:00");
        setHoraFin("22:00");
        setFechaInicio("");
        setFechaFin("");
        setIsDialogOpen(true);
    };

    const openEdit = (r: HorarioPrimeRange) => {
        setEditingId(r.id);
        setCancha(r.cancha);
        setHoraInicio(r.hora_inicio);
        setHoraFin(r.hora_fin);
        setFechaInicio(r.fecha_inicio || "");
        setFechaFin(r.fecha_fin || "");
        setIsDialogOpen(true);
    };

    const deleteRange = (id: string) => {
        setRanges(ranges.filter(r => r.id !== id));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();

        const [h_ini_h, h_ini_m] = horaInicio.split(':').map(Number);
        const [h_fin_h, h_fin_m] = horaFin.split(':').map(Number);
        const minsInicio = h_ini_h * 60 + h_ini_m;
        const minsFin = h_fin_h * 60 + h_fin_m;

        const diffMins = minsFin - minsInicio;
        if (diffMins <= 0 || diffMins % 180 !== 0) {
            alert("Error: El bloque de tiempo debe ser un múltiplo exacto de 3 horas (ej: de 17:00 a 20:00, o de 18:30 a 21:30) para evitar dejar franjas sueltas de media hora.");
            return;
        }

        if (editingId) {
            setRanges(ranges.map(r => r.id === editingId ? {
                ...r,
                cancha, hora_inicio: horaInicio, hora_fin: horaFin, fecha_inicio: fechaInicio, fecha_fin: fechaFin
            } : r));
        } else {
            setRanges([...ranges, {
                id: crypto.randomUUID(),
                cancha,
                hora_inicio: horaInicio,
                hora_fin: horaFin,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin
            }]);
        }
        setIsDialogOpen(false);
    };

    const timeOptions = [];
    for (let h = 6; h <= 23; h++) {
        timeOptions.push(`${String(h).padStart(2, '0')}:00`);
        timeOptions.push(`${String(h).padStart(2, '0')}:30`);
    }

    return (
        <div className="space-y-4">
            <input type="hidden" name="prime_ranges" value={JSON.stringify(ranges)} />

            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-sm font-medium text-emerald-400">Reglas de Horario Prime (1 Hora y Media obligatoria)</h3>
                    <p className="text-xs text-neutral-400">Configura rangos de fechas, horas y canchas en las que solo se permitan reservas de 90 mins.</p>
                </div>
                <Button type="button" onClick={openCreate} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Plus className="w-4 h-4 mr-1" /> Añadir Regla
                </Button>
            </div>

            {ranges.length === 0 ? (
                <div className="bg-neutral-950/50 border border-neutral-800 border-dashed rounded-lg p-6 text-center text-neutral-500 text-sm flex flex-col items-center">
                    <Clock className="w-8 h-8 opacity-20 mb-2" />
                    No hay restricciones de horario prime configuradas. Se permitirán reservas de 60 y 90 minutos libremente.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {ranges.map(r => (
                        <div key={r.id} className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 flex justify-between items-center group">
                            <div>
                                <h4 className="text-white font-medium text-sm">
                                    {r.cancha === 'all' ? 'Todas las Canchas' : `Cancha ${r.cancha}`}
                                </h4>
                                <div className="text-xs text-neutral-400 mt-1 space-x-3">
                                    <span>⏱ {r.hora_inicio} a {r.hora_fin}</span>
                                    {(r.fecha_inicio || r.fecha_fin) ? (
                                        <span>📅 {r.fecha_inicio || 'Siempre'} hasta {r.fecha_fin || 'Siempre'}</span>
                                    ) : (
                                        <span>📅 Todos los días</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(r)} className="h-8 bg-neutral-900 border-neutral-700 hover:text-white">
                                    <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button type="button" variant="destructive" size="sm" onClick={() => deleteRange(r.id)} className="h-8 bg-neutral-900 border-red-900/50 text-red-500 hover:bg-red-900/20">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800 text-neutral-100">
                    <DialogHeader>
                        <DialogTitle className="text-xl">{editingId ? 'Editar Regla Prime' : 'Nueva Regla Prime'}</DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Define el bloque donde las reservas deben ser de hora y media obligatoriamente.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label className="text-neutral-300">Aplica para:</Label>
                            <Select value={cancha} onValueChange={setCancha} required>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="all">Todas las Canchas</SelectItem>
                                    <SelectItem value="1">Cancha 1</SelectItem>
                                    <SelectItem value="2">Cancha 2</SelectItem>
                                    <SelectItem value="3">Cancha 3</SelectItem>
                                    <SelectItem value="4">Cancha 4</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-neutral-300">Hora Inicio</Label>
                                <Select value={horaInicio} onValueChange={setHoraInicio} required>
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                        <SelectValue placeholder="Hora Inicio" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-neutral-800 text-white h-[200px]">
                                        {timeOptions.map(t => <SelectItem key={`ini-${t}`} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-neutral-300">Hora Fin</Label>
                                <Select value={horaFin} onValueChange={setHoraFin} required>
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                        <SelectValue placeholder="Hora Fin" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-neutral-800 text-white h-[200px]">
                                        {timeOptions.map(t => <SelectItem key={`fin-${t}`} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-neutral-300">Desde (Fecha)</Label>
                                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="bg-neutral-950 border-neutral-800 text-white [color-scheme:dark]" />
                                <span className="text-[10px] text-neutral-500">Opcional</span>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-neutral-300">Hasta (Fecha)</Label>
                                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="bg-neutral-950 border-neutral-800 text-white [color-scheme:dark]" />
                                <span className="text-[10px] text-neutral-500">Opcional</span>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-neutral-800 hover:text-white">Cancelar</Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">Guardar Regla</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            <div className="mt-2 text-[11px] text-amber-500 font-medium">
                ⚠️ Recuerda que después de configurar estas reglas, debes hacer clic en el botón principal &quot;Guardar Configuraciones&quot; de la parte inferior para guardar los cambios a la base de datos de tu club.
            </div>
        </div>
    );
}
