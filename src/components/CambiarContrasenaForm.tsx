"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, Check } from "lucide-react";
import { cambiarMiContrasena } from "@/app/actions/contrasena";

/**
 * Cambiar la contraseña de la cuenta propia.
 *
 * `temporal`: la cuenta entró con una contraseña que le entregó el
 * superadmin. No se pide la actual, y al terminar se sigue a la app.
 */
export function CambiarContrasenaForm({ temporal = false }: { temporal?: boolean }) {
    const router = useRouter();
    const [pendiente, startTransition] = useTransition();
    const [actual, setActual] = useState("");
    const [nueva, setNueva] = useState("");
    const [repetida, setRepetida] = useState("");
    const [ver, setVer] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [listo, setListo] = useState(false);

    const enviar = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setListo(false);
        if (nueva !== repetida) { setError("Las dos contraseñas nuevas no coinciden."); return; }
        startTransition(async () => {
            const r = await cambiarMiContrasena({ actual: temporal ? undefined : actual, nueva });
            if (!r.ok) { setError(r.mensaje); return; }
            setActual(""); setNueva(""); setRepetida("");
            if (r.reingresar) {
                router.replace("/login");
                return;
            }
            if (temporal) {
                // El inicio decide a dónde va cada rol.
                router.replace("/");
                router.refresh();
            } else {
                setListo(true);
            }
        });
    };

    const tipo = ver ? "text" : "password";

    return (
        <form onSubmit={enviar} className="space-y-4">
            {!temporal && (
                <div className="space-y-1.5">
                    <Label htmlFor="contrasena-actual" className="text-ink">Contraseña actual</Label>
                    <Input id="contrasena-actual" type={tipo} autoComplete="current-password" required
                        value={actual} onChange={e => setActual(e.target.value)}
                        className="bg-paper border-olive/20 text-ink h-11" />
                </div>
            )}
            <div className="space-y-1.5">
                <Label htmlFor="contrasena-nueva" className="text-ink">Contraseña nueva</Label>
                <div className="relative">
                    <Input id="contrasena-nueva" type={tipo} autoComplete="new-password" required minLength={8}
                        value={nueva} onChange={e => setNueva(e.target.value)}
                        className="bg-paper border-olive/20 text-ink h-11 pr-11" />
                    <button type="button" onClick={() => setVer(v => !v)}
                        aria-label={ver ? "Ocultar contraseñas" : "Ver contraseñas"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-olive/60 hover:text-ink rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-olive">
                        {ver ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-[11px] text-olive/60">Mínimo 8 caracteres.</p>
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="contrasena-repetida" className="text-ink">Repite la contraseña nueva</Label>
                <Input id="contrasena-repetida" type={tipo} autoComplete="new-password" required minLength={8}
                    value={repetida} onChange={e => setRepetida(e.target.value)}
                    className="bg-paper border-olive/20 text-ink h-11" />
            </div>

            {error && <p className="text-sm text-red-700 font-semibold" role="alert">{error}</p>}
            {listo && (
                <p className="text-sm text-emerald-700 font-semibold flex items-center gap-1.5" role="status">
                    <Check className="w-4 h-4" /> Contraseña cambiada. Se cerraron las sesiones abiertas en otros dispositivos.
                </p>
            )}

            <Button type="submit" disabled={pendiente} className="bg-olive hover:bg-olive-dark text-paper font-bold h-11 w-full sm:w-auto">
                {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : temporal ? "Guardar y entrar" : "Cambiar contraseña"}
            </Button>
        </form>
    );
}
