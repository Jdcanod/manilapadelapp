"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Save, Megaphone, Settings2, User, Image as ImageIcon, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cerrarSesionAction } from "../../jugador/perfil/actions";
import { saveClubSettings, postClubNews, updateClubProfile, uploadClubLogo } from "./actions";
import { PrimeTimeConfig } from "@/components/PrimeTimeConfig";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ConfigData {
    nombre: string;
    foto: string;
    precio_hora_base: number;
    precio_fin_semana: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    horarios_solo_90_min_json: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    canchas_activas_json: any;
    tiempo_cancelacion_minutos: number;
    userId: string;
}

export function ConfigClubForm({ initialData }: { initialData: ConfigData }) {
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [logoUrl, setLogoUrl] = useState(initialData.foto);


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

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        formData.append("foto", logoUrl);
        
        try {
            await updateClubProfile(initialData.userId, formData);
            alert("✅ Perfil del club actualizado correctamente.");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Error desconocido";
            alert("❌ " + msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("logo", file);
            
            const result = await uploadClubLogo(initialData.userId, formData);
            setLogoUrl(result.publicUrl);
        } catch (error) {
            alert("Error subiendo el logo: " + (error instanceof Error ? error.message : "Desconocido"));
        } finally {
            setIsUploading(false);
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
                <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 border-2 border-neutral-800 shadow-lg">
                        <AvatarImage src={logoUrl} />
                        <AvatarFallback className="bg-neutral-800 text-white font-bold">{initialData.nombre.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">{initialData.nombre || "Mi Club"}</h1>
                        <p className="text-sm text-neutral-400">Panel de Administración Profesional</p>
                    </div>
                </div>
                <form action={cerrarSesionAction}>
                    <Button type="submit" variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/50">
                        <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
                    </Button>
                </form>
            </div>

            <Tabs defaultValue="perfil" className="w-full">
                <TabsList className="bg-neutral-900 border border-neutral-800 p-1 mb-6">
                    <TabsTrigger value="perfil" className="data-[state=active]:bg-neutral-800">
                        <User className="w-4 h-4 mr-2" />
                        Perfil del Club
                    </TabsTrigger>
                    <TabsTrigger value="ajustes" className="data-[state=active]:bg-neutral-800">
                        <Settings2 className="w-4 h-4 mr-2" />
                        Ajustes de Canchas
                    </TabsTrigger>
                    <TabsTrigger value="anuncios" className="data-[state=active]:bg-neutral-800">
                        <Megaphone className="w-4 h-4 mr-2" />
                        Publicar Anuncios
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="perfil">
                    <form onSubmit={handleUpdateProfile}>
                        <Card className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden">
                            <div className="h-32 bg-gradient-to-r from-emerald-600 to-green-400 opacity-20" />
                            <CardHeader className="-mt-16 relative px-6">
                                <div className="flex flex-col sm:flex-row items-end gap-6">
                                    <div className="relative group">
                                        <Avatar className="w-32 h-32 border-4 border-neutral-900 shadow-2xl bg-neutral-800">
                                            <AvatarImage src={logoUrl} />
                                            <AvatarFallback className="text-4xl font-black text-neutral-600">LOGO</AvatarFallback>
                                        </Avatar>
                                        <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full border-2 border-dashed border-emerald-500">
                                            {isUploading ? (
                                                <Loader2 className="w-8 h-8 text-white animate-spin" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-white" />
                                            )}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploading} />
                                        </label>
                                    </div>
                                    <div className="pb-4">
                                        <CardTitle className="text-2xl text-white">Información Pública</CardTitle>
                                        <CardDescription className="text-neutral-400">Esta información aparecerá en tus torneos y reportes PDF.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-neutral-300">Nombre Comercial del Club</Label>
                                        <Input 
                                            name="nombre" 
                                            defaultValue={initialData.nombre} 
                                            placeholder="Ej. Manila Padel Club"
                                            className="bg-neutral-950 border-neutral-800 text-white h-12" 
                                        />
                                    </div>
                                    <div className="space-y-2 opacity-50 cursor-not-allowed">
                                        <Label className="text-neutral-300">Correo de Contacto (Único)</Label>
                                        <Input 
                                            disabled 
                                            value="info@club.com" 
                                            className="bg-neutral-950 border-neutral-800 text-neutral-500 h-12" 
                                        />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-neutral-950/50 border-t border-neutral-800 p-6 flex justify-end">
                                <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8">
                                    {isSaving ? "Guardando..." : <><Save className="w-4 h-4 mr-2" /> Actualizar Perfil</>}
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </TabsContent>

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
                                    <h3 className="text-sm font-medium text-emerald-400 uppercase tracking-widest text-[10px]">Canchas Activas (Check para habilitar)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map((num) => (
                                            <div key={num} className="flex items-center justify-between bg-neutral-950 p-4 rounded-xl border border-neutral-800 hover:border-emerald-500/30 transition-colors">
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
                                <div className="space-y-4 pt-4 border-t border-neutral-800/50">
                                    <h3 className="text-sm font-medium text-emerald-400 uppercase tracking-widest text-[10px]">Tarifas (COP)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-neutral-300">Precio Lunes - Viernes</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                                                <Input name="precio_base" type="number" defaultValue={initialData.precio_hora_base} className="pl-8 bg-neutral-950 border-neutral-800 text-white h-11" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-neutral-300">Precio Fin de Semana y Feriados</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                                                <Input name="precio_fin" type="number" defaultValue={initialData.precio_fin_semana} className="pl-8 bg-neutral-950 border-neutral-800 text-white h-11" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Políticas y Cancelaciones */}
                                <div className="space-y-4 pt-4 border-t border-neutral-800/50">
                                    <h3 className="text-sm font-medium text-emerald-400 uppercase tracking-widest text-[10px]">Cancelaciones Automáticas</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-neutral-300">Tiempo de Cancelación Mínimo</Label>
                                            <p className="text-[10px] text-neutral-500 mb-2">Partidos sin los 4 jugadores se cancelarán automáticamente a falta de este tiempo.</p>
                                            <Select name="tiempo_cancelacion" defaultValue={String(initialData.tiempo_cancelacion_minutos || 120)}>
                                                <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white w-full h-11">
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
                                <PrimeTimeConfig initialRanges={initialData.horarios_solo_90_min_json} />

                            </CardContent>
                            <CardFooter className="bg-neutral-950/50 border-t border-neutral-800 p-6 flex justify-end">
                                <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                    {isSaving ? "Guardando..." : <><Save className="w-4 h-4 mr-2" /> Guardar Configuraciones</>}
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
                                        <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white w-full sm:w-[250px] h-11">
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
                                    <Input name="titulo" required placeholder="Ej. Gran Torneo Express 4ta. Premios de raqueta." className="bg-neutral-950 border-neutral-800 text-white h-11" />
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
