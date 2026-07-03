"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inscribirParejaTorneo, buscarCompaneros } from "./actions";
import { Trophy, Users, CheckCircle2, Search, X } from "lucide-react";

interface Props {
    torneoId: string;
    torneoNombre: string;
}

export function InscribirParejaDialog({ torneoId, torneoNombre }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ id: string, nombre: string, email: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedCompanero, setSelectedCompanero] = useState<{ id: string, nombre: string, email: string } | null>(null);

    // Handle Search functionality
    async function handleSearch(query: string) {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await buscarCompaneros(query);
            setSearchResults(results);
        } catch {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }

    async function handleSubmit(formData: FormData) {
        setError(null);
        setSuccess(false);

        if (!selectedCompanero) {
            setError("Debes buscar y seleccionar a tu compañero antes de inscribirte.");
            return;
        }

        formData.append("email_companero", selectedCompanero.email);
        formData.append("torneo_id", torneoId);

        startTransition(async () => {
            try {
                const response = await inscribirParejaTorneo(formData);
                if (response && 'error' in response) {
                    setError(response.error ?? "Error desconocido");
                } else if (response && response.success) {
                    setSuccess(true);
                    // Cerrar modal automáticamente después de 2.5s
                    setTimeout(() => {
                        setOpen(false);
                        setSuccess(false);
                    }, 2500);
                } else {
                    setError("Ocurrió un error inesperado al procesar la solicitud.");
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : "Ocurrió un error al inscribirse";
                setError(errorMessage);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-amber-600 hover:bg-amber-500 text-ink font-bold transition-all shadow-lg hover:shadow-amber-500/20">
                    <Trophy className="w-4 h-4 mr-2" />
                    Inscribir Pareja
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-paper-soft border-olive/20 text-ink">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-600" />
                        Inscripción al Torneo
                    </DialogTitle>
                    <DialogDescription className="text-olive/70">
                        Únete con tu compañero al torneo <strong className="text-ink">{torneoNombre}</strong>. Su estado quedará como pendiente de pago hasta que el club lo confirme.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-16 h-16 text-emerald-700" />
                        <h3 className="text-xl font-bold text-ink text-center">¡Inscripción Exitosa!</h3>
                        <p className="text-sm text-olive/70 text-center">Ya están apuntados al torneo. Revisa tu email o habla con el club para gestionar el pago.</p>
                    </div>
                ) : (
                    <form action={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2 relative">
                            <Label>Busca a tu Compañero (Por Nombre)</Label>

                            {selectedCompanero ? (
                                <div className="flex items-center justify-between bg-paper border border-emerald-500/50 p-3 rounded-lg">
                                    <div>
                                        <p className="font-bold text-emerald-700">{selectedCompanero.nombre}</p>
                                        <p className="text-xs text-olive/70">{selectedCompanero.email}</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSelectedCompanero(null)}
                                        className="text-olive/60 hover:text-red-400 hover:bg-red-500/10"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                    <input type="hidden" name="email_companero" value={selectedCompanero.email} />
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="w-4 h-4 text-olive/60" />
                                    </div>
                                    <Input
                                        type="text"
                                        placeholder="Ej: Juan Pérez"
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        className="bg-paper border-olive/20 focus:border-emerald-500 pl-9"
                                        autoComplete="off"
                                    />

                                    {searchQuery.length >= 2 && (
                                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-paper-soft border border-olive/20 rounded-lg shadow-xl overflow-hidden">
                                            {isSearching ? (
                                                <div className="p-3 text-sm text-center text-olive/70">Buscando...</div>
                                            ) : searchResults.length > 0 ? (
                                                <div className="max-h-48 overflow-y-auto">
                                                    {searchResults.map((user) => (
                                                        <button
                                                            key={user.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedCompanero(user);
                                                                setSearchQuery("");
                                                                setSearchResults([]);
                                                            }}
                                                            className="w-full text-left p-3 border-b border-olive/20 hover:bg-paper-dark transition-colors last:border-0"
                                                        >
                                                            <div className="font-bold text-ink">{user.nombre}</div>
                                                            <div className="text-xs text-olive/70">{user.email}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-3 text-sm text-center text-olive/70">No se encontraron jugadores</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            <p className="text-[10px] text-olive/60">
                                Buscamos entre los usuarios que ya están registrados en la app.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoría a competir</Label>
                            <Select name="categoria" required disabled={isPending}>
                                <SelectTrigger className="bg-paper border-olive/20">
                                    <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="1ra">1ra Categoría</SelectItem>
                                    <SelectItem value="2da">2da Categoría</SelectItem>
                                    <SelectItem value="3ra">3ra Categoría</SelectItem>
                                    <SelectItem value="4ta">4ta Categoría</SelectItem>
                                    <SelectItem value="5ta">5ta Categoría</SelectItem>
                                    <SelectItem value="6ta">6ta Categoría</SelectItem>
                                    <SelectItem value="7ma">7ma Categoría</SelectItem>
                                    <SelectItem value="Damas 6ta">Damas 6ta</SelectItem>
                                    <SelectItem value="Damas 7ma">Damas 7ma</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>



                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm mt-4">
                                {error}
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="hover:bg-paper-dark hover:text-ink"
                                disabled={isPending}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="bg-emerald-600 hover:bg-emerald-500 text-ink font-bold"
                            >
                                {isPending ? "Procesando..." : "Confirmar Inscripción"}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
