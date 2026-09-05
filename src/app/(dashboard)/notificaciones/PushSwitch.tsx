"use client";

import { useEffect, useState, useTransition } from "react";
import { Smartphone, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { guardarSuscripcionPush, borrarSuscripcionPush } from "./actions";

/**
 * Avisos en el celular con la app cerrada.
 *
 * Es POR DISPOSITIVO, no por cuenta: el interruptor refleja si ESTE teléfono
 * está suscrito, no una preferencia global. Por eso no se lee del servidor sino
 * del navegador — es el único que sabe la verdad.
 *
 * Qué avisos llegan lo siguen mandando los tres grupos de arriba: esto solo
 * decide si además suenan acá.
 */

type Estado = 'cargando' | 'no-soportado' | 'ios-sin-instalar' | 'bloqueado' | 'apagado' | 'encendido';

/** base64url -> bytes, que es lo que espera `pushManager.subscribe`. */
function claveAplicacion(base64: string): ArrayBuffer {
    const relleno = '='.repeat((4 - (base64.length % 4)) % 4);
    const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const crudo = atob(normal);
    const bytes = new Uint8Array(new ArrayBuffer(crudo.length));
    for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
    return bytes.buffer;
}

function esIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
        // iPadOS se reporta como Mac; el touch lo delata.
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** En iOS el push solo existe si la PWA está en la pantalla de inicio. */
function instaladaComoApp(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function PushSwitch() {
    const [estado, setEstado] = useState<Estado>('cargando');
    const [pendiente, startTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        (async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                // En iPhone sin instalar, PushManager directamente no existe:
                // conviene explicar por qué en vez de decir "no compatible".
                setEstado(esIOS() && !instaladaComoApp() ? 'ios-sin-instalar' : 'no-soportado');
                return;
            }
            if (Notification.permission === 'denied') { setEstado('bloqueado'); return; }

            const reg = await navigator.serviceWorker.getRegistration();
            const sub = await reg?.pushManager.getSubscription();
            setEstado(sub ? 'encendido' : 'apagado');
        })();
    }, []);

    const encender = async () => {
        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') {
            setEstado(permiso === 'denied' ? 'bloqueado' : 'apagado');
            return;
        }

        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!clave) {
            toast({ title: 'Falta configurar el servidor', description: 'Avisale al club.', variant: 'destructive' });
            return;
        }

        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: claveAplicacion(clave),
        });

        const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
        const res = await guardarSuscripcionPush({
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh ?? '',
            auth: json.keys?.auth ?? '',
            userAgent: navigator.userAgent,
        });

        if (res.ok) {
            setEstado('encendido');
            toast({ title: 'Listo', description: 'Te vamos a avisar en este dispositivo.' });
        } else {
            // Sin fila en el servidor la suscripción del navegador no sirve
            // para nada: se deshace para no dejar un estado mentiroso.
            await sub.unsubscribe();
            toast({ title: 'No se pudo activar', description: res.mensaje, variant: 'destructive' });
        }
    };

    const apagar = async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
            await borrarSuscripcionPush(sub.endpoint);
            await sub.unsubscribe();
        }
        setEstado('apagado');
    };

    const alternar = () => startTransition(async () => {
        try {
            if (estado === 'encendido') await apagar();
            else await encender();
        } catch (e) {
            console.error('[push]', e);
            toast({ title: 'Algo salió mal', description: 'Intentá de nuevo.', variant: 'destructive' });
        }
    });

    if (estado === 'cargando') return null;

    if (estado === 'ios-sin-instalar' || estado === 'no-soportado' || estado === 'bloqueado') {
        return (
            <div className="flex items-start gap-2.5 px-4 py-3 border-t border-olive/15 text-[11px] text-olive/70">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-olive/50" />
                <p className="leading-relaxed">
                    {estado === 'ios-sin-instalar' && (
                        <>
                            <span className="font-semibold text-ink">Para que suene en tu iPhone</span>, primero
                            agrega Pádel Manía a la pantalla de inicio: botón Compartir → «Añadir a inicio».
                            Es un requisito de Apple, no de la app.
                        </>
                    )}
                    {estado === 'no-soportado' && 'Este navegador no puede mandar avisos con la app cerrada.'}
                    {estado === 'bloqueado' && (
                        <>
                            <span className="font-semibold text-ink">Bloqueaste los avisos</span> para este sitio.
                            Se vuelven a permitir desde los ajustes del navegador.
                        </>
                    )}
                </p>
            </div>
        );
    }

    const activo = estado === 'encendido';
    return (
        <div className="px-4 py-3 border-t border-olive/15">
            <label className="flex items-start gap-3 cursor-pointer">
                <button
                    type="button"
                    role="switch"
                    aria-checked={activo}
                    aria-label="Avisarme en este dispositivo"
                    disabled={pendiente}
                    onClick={alternar}
                    className={cn(
                        "mt-0.5 w-10 h-6 rounded-full shrink-0 relative transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre focus-visible:ring-offset-1",
                        activo ? "bg-olive" : "bg-paper-dark",
                    )}
                >
                    <span className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-paper shadow-sm transition-transform",
                        activo ? "translate-x-[18px]" : "translate-x-0.5",
                    )} />
                </button>
                <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <Smartphone className="w-3.5 h-3.5 text-ochre-dark" />
                        Avisarme en este dispositivo
                        {pendiente && <Loader2 className="w-3 h-3 animate-spin text-olive/50" />}
                    </span>
                    <span className="block text-[11px] text-olive/70 leading-relaxed">
                        Los avisos suenan aunque tengas la app cerrada. Solo en este aparato — si usas
                        también el computador, préndelo allá.
                    </span>
                </span>
            </label>
        </div>
    );
}
