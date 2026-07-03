import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trophy, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { createTorneoCiudad } from "../actions";

export default function NuevoTorneoMasterPage() {
    const niveles = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "Open", "Femenino A", "Femenino B"];

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <Link href="/superadmin/torneos" className="inline-flex items-center text-sm text-olive/70 hover:text-ink transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Torneos
            </Link>

            <div className="flex items-center gap-3 bg-gradient-to-r from-paper to-paper-soft border border-olive/20 p-4 rounded-2xl shadow-xl">
                <div className="bg-paper-dark p-3 rounded-xl border border-olive/30">
                    <Trophy className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-ink tracking-tight">Crear Nuevo Torneo (Ciudad)</h1>
                    <p className="text-sm text-olive/70">Torneo maestro visible para todos los jugadores de la ciudad.</p>
                </div>
            </div>

            <Card className="bg-paper-soft border-olive/20 shadow-xl overflow-hidden">
                <div className="h-1 w-full bg-violet-600" />
                <form action={createTorneoCiudad}>
                    <CardHeader>
                        <CardTitle className="text-ink text-lg">Información Principal</CardTitle>
                        <CardDescription className="text-olive/70">Asegúrate de configurar correctamente los datos del circuito.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="nombre" className="text-ink-soft">Nombre del Torneo</Label>
                                <Input id="nombre" name="nombre" placeholder="Ej. Master Final Manizales 2026" required className="bg-paper border-olive/20 text-ink" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ciudad" className="text-ink-soft">Ciudad Sede</Label>
                                <Input id="ciudad" name="ciudad" defaultValue="Manizales" required className="bg-paper border-olive/20 text-ink" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="fecha_inicio" className="text-ink-soft">Fecha de Inicio</Label>
                                <Input id="fecha_inicio" name="fecha_inicio" type="date" required className="bg-paper border-olive/20 text-ink" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="fecha_fin" className="text-ink-soft">Fecha de Fin</Label>
                                <Input id="fecha_fin" name="fecha_fin" type="date" required className="bg-paper border-olive/20 text-ink" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="formato" className="text-ink-soft">Formato del Torneo</Label>
                                <Select name="formato" defaultValue="Grupos y Llaves">
                                    <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                        <SelectValue placeholder="Seleccionar formato" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                        <SelectItem value="Grupos y Llaves">Fase de Grupos + Llaves</SelectItem>
                                        <SelectItem value="Eliminacion Directa">Eliminación Directa</SelectItem>
                                        <SelectItem value="Americano">Torneo Americano</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="precio_inscripcion" className="text-ink-soft">Costo de Inscripción (COP por pareja)</Label>
                                <Input id="precio_inscripcion" name="precio_inscripcion" type="number" min="0" placeholder="Ej. 120000" defaultValue="100000" className="bg-paper border-olive/20 text-ink" />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Label className="text-ink-soft block mb-2">Categorías Abiertas (Selecciona al menos una)</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-paper p-4 border border-olive/20 rounded-lg">
                                {niveles.map((nivel) => (
                                    <div key={nivel} className="flex items-center space-x-2">
                                        <Checkbox 
                                            name="niveles" 
                                            value={nivel} 
                                            id={`nivel-${nivel}`} 
                                            defaultChecked={["2da", "3ra", "4ta", "5ta", "6ta"].includes(nivel)}
                                            className="border-olive/30 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                                        />
                                        <Label htmlFor={`nivel-${nivel}`} className="text-sm font-normal cursor-pointer text-ink-soft">
                                            Categoría {nivel}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="bg-paper border-t border-olive/20 p-6 flex justify-end gap-3">
                        <Link href="/superadmin/torneos">
                            <Button type="button" variant="outline" className="bg-transparent border-olive/30 text-ink-soft hover:bg-paper-dark hover:text-ink">
                                Cancelar
                            </Button>
                        </Link>
                        <Button type="submit" className="bg-violet-600 hover:bg-violet-700 text-ink border-0 shadow-lg shadow-violet-900/20">
                            <Save className="w-4 h-4 mr-2" /> Guardar y Publicar Torneo
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
