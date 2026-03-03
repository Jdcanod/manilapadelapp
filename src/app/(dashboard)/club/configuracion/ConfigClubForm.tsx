"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Save, Megaphone, Settings2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cerrarSesionAction } from "../../jugador/perfil/actions";
import { saveClubSettings, postClubNews } from "./actions";

interface ConfigData {
    precio_hora_base: number;
    precio_fin_semana: number;
    horarios_solo_90_min_json: Record<string, string[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canchas_activas_json: any;
    tiempo_cancelacion_minutos: number;
    userId: string;
}

export function ConfigClubForm({ initialData }: { initialData: ConfigData }) {
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        try {
            await saveClubSettings(initialData.userId, formData);
            alert("✅ Ajustes operativos guardados exitosamente.");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            alert("❌ " + msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePostNews = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        try {
            await postClubNews(initialData.userId, formData);
            alert("📣 Anuncio publicado exitosamente hacia la comunidad.");
            form.reset();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            alert("❌ " + msg);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Administración del Club</h1>
                    <p className="text-neutral-400">Gestiona canchas, precios y comunícate con la comunidad.</p>
                </div>
                <form action={cerrarSesionAction}>
                    <Button type="submit" variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/50">
                        <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
                    </Button>
                </form>
            </div>

            <Tabs defaultValue="ajustes" className="w-full">
                <TabsList className="bg-neutral-900 border border-neutral-800 p-1 mb-6">
                    <TabsTrigger value="ajustes" className="data-[state=active]:bg-neutral-800">
                        <Settings2 className="w-4 h-4 mr-2" />
                        Configuración de Canchas
                    </TabsTrigger>
                    <TabsTrigger value="anuncios" className="data-[state=active]:bg-neutral-800">
                        <Megaphone className="w-4 h-4 mr-2" />
                        Publicar Anuncios
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="ajustes">
                    <form onSubmit={handleSaveSettings}>
                        <Card className="bg-neutral-900 border-neutral-800 shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-white">Ajustes Operativos</CardTitle>
                                <CardDescription className="text-neutral-400">Configura la disponibilidad y precios para tus jugadores.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">

                                {/* Canchas */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-emerald-400">Canchas Activas (Check para habilitar)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map((num) => (
                                            <div key={num} className="flex items-center justify-between bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                                <Label htmlFor={`cancha-${num}`} className="text-white font-medium cursor-pointer">Cancha {num}</Label>
                                                <Switch
                                                    id={`cancha-${num}`}
                                                    name={`cancha-${num}`}
                                                    defaultChecked={initialData.canchas_activas_json?.[String(num)] ?? true}
                                                    className="data-[state=checked]:bg-emerald-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Precios */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-emerald-400">Tarifas (COP)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-neutral-300">Precio Lunes - Viernes</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                                                <Input name="precio_base" type="number" defaultValue={initialData.precio_hora_base} className="pl-8 bg-neutral-950 border-neutral-800 text-white" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-neutral-300">Precio Fin de Semana y Feriados</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                                                <Input name="precio_fin" type="number" defaultValue={initialData.precio_fin_semana} className="pl-8 bg-neutral-950 border-neutral-800 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Políticas y Cancelaciones */}
                                <div className="space-y-4 pt-4 border-t border-neutral-800">
                                    <h3 className="text-sm font-medium text-emerald-400">Cancelaciones Automáticas</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-neutral-300">Tiempo de Cancelación Mínimo</Label>
                                            <p className="text-[10px] text-neutral-500 mb-2">Partidos sin los 4 jugadores se cancelarán automáticamente a falta de este tiempo.</p>
                                            <Select name="tiempo_cancelacion" defaultValue={String(initialData.tiempo_cancelacion_minutos || 120)}>
                                                <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white w-full">
                                                    <SelectValue placeholder="Seleccionar..." />
                                                </SelectTrigger>
                                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                                    <SelectItem value="30">30 minutos antes</SelectItem>
                                                    <SelectItem value="45">45 minutos antes</SelectItem>
                                                    <SelectItem value="60">1 hora antes</SelectItem>
                                                    <SelectItem value="120">2 horas antes</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Horarios Prime (Obliga 90 mins) */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-emerald-400">Horarios Prime por Cancha (1 Hora y Media)</h3>
                                    <p className="text-xs text-neutral-400">Selecciona en qué horas y canchas se exigiría reservas obligatorias de 90 minutos para optimizar la grilla.</p>
                                    <div className="space-y-4">
                                        {[1, 2, 3, 4].map((num) => {
                                            const isActive = initialData.canchas_activas_json?.[String(num)] ?? true;
                                            if (!isActive) return null;

                                            // Make sure we have safely an array, falling back to an empty one or adapting an older flat array
                                            const savedVal = initialData.horarios_solo_90_min_json?.[String(num)];
                                            let horariosCourt: string[] = [];
                                            if (Array.isArray(savedVal)) {
                                                horariosCourt = savedVal;
                                            } else if (Array.isArray(initialData.horarios_solo_90_min_json) && Object.keys(initialData.horarios_solo_90_min_json).length > 0 && typeof initialData.horarios_solo_90_min_json[0] === 'string') {
                                                // Fallback if data was old style string[]
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                horariosCourt = (initialData.horarios_solo_90_min_json as any) as string[];
                                            }

                                            return (
                                                <div key={num} className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
                                                    <h4 className="text-sm font-bold text-white mb-3">Cancha {num}</h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                        {["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"].map((hora) => {
                                                            const isChecked = horariosCourt.includes(hora);
                                                            return (
                                                                <div key={hora} className="flex items-center justify-center space-x-2 bg-neutral-900 px-2 py-3 rounded-md border border-neutral-800 transition-colors hover:border-emerald-500/50">
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`prime-c${num}-${hora}`}
                                                                        name={`prime_cancha_${num}`}
                                                                        value={hora}
                                                                        defaultChecked={isChecked}
                                                                        className="w-4 h-4 accent-emerald-500 rounded border-neutral-700 bg-neutral-900 cursor-pointer"
                                                                    />
                                                                    <Label htmlFor={`prime-c${num}-${hora}`} className="text-neutral-300 cursor-pointer select-none text-xs font-mono">{hora}</Label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                            </CardContent>
                            <CardFooter className="bg-neutral-950/50 border-t border-neutral-800 p-6 flex justify-end">
                                <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                    {isSaving ? "Escribiendo en Supabase..." : <><Save className="w-4 h-4 mr-2" /> Guardar Configuraciones</>}
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </TabsContent>

                <TabsContent value="anuncios">
                    <form onSubmit={handlePostNews}>
                        <Card className="bg-neutral-900 border-neutral-800 shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-white">Publicar Novedad Oficial</CardTitle>
                                <CardDescription className="text-neutral-400">Informa a los jugadores locales sobre torneos, clases o promociones (Aparecerá en el panel de los jugadores).</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-neutral-300">Tipo de Anuncio</Label>
                                    <Select name="tipo" defaultValue="torneo">
                                        <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white w-full sm:w-[250px]">
                                            <SelectValue placeholder="Tipo" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                            <SelectItem value="torneo">🏆 Torneo o Americano</SelectItem>
                                            <SelectItem value="promocion">🔥 Promoción / Descuento</SelectItem>
                                            <SelectItem value="clase">🎾 Clases y Entrenamientos</SelectItem>
                                            <SelectItem value="aviso">ℹ️ Aviso General</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-neutral-300">Título Corto</Label>
                                    <Input name="titulo" required placeholder="Ej. Gran Torneo Express 4ta. Premios de raqueta." className="bg-neutral-950 border-neutral-800 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-neutral-300">Descripción Larga del Evento</Label>
                                    <Textarea name="contenido" required placeholder="Escribe la hora, fecha, premios de tu evento o el motivo de tu promoción..." className="bg-neutral-950 border-neutral-800 text-white min-h-[140px]" />
                                </div>
                            </CardContent>
                            <CardFooter className="bg-neutral-950/50 border-t border-neutral-800 p-6 flex justify-end">
                                <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white">
                                    {isSaving ? "Subiendo a Supabase..." : <><Megaphone className="w-4 h-4 mr-2" /> Anunciar a la Comunidad</>}
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </TabsContent>

            </Tabs>
        </div>
    );
}
