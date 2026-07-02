"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toggleSeguirClub } from "@/app/(dashboard)/clubes/[id]/actions";
import { useToast } from "@/hooks/use-toast";

interface Props {
    clubId: string;
    clubNombre: string;
    jugadorAuthId: string;
    initialIsFollowing: boolean;
}

export function BotonSeguirClub({ clubId, clubNombre, jugadorAuthId, initialIsFollowing }: Props) {
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleToggle = async () => {
        setLoading(true);
        try {
            await toggleSeguirClub(clubId, jugadorAuthId, isFollowing);
            setIsFollowing(!isFollowing);

            toast({
                title: isFollowing ? "Dejaste de seguir" : "¡Siguiendo al club!",
                description: isFollowing
                    ? `Ya no eres miembro de ${clubNombre}.`
                    : `Ahora recibirás novedades y aparecerás en el ranking de ${clubNombre}.`,
                variant: isFollowing ? "default" : "default" // could change styling
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "No se pudo actualizar la suscripción al club.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (isFollowing) {
        return (
            <Button
                onClick={handleToggle}
                disabled={loading}
                variant="outline"
                className="w-full md:w-auto h-12 md:h-10 bg-neutral-900 border-emerald-500/50 text-emerald-400 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 transition-colors group"
            >
                {loading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                    <>
                        <UserCheck className="w-5 h-5 mr-2 group-hover:hidden" />
                        <span className="group-hover:hidden font-bold">Eres Miembro</span>
                        <span className="hidden group-hover:block font-bold">Dejar de Seguir</span>
                    </>
                )}
            </Button>
        );
    }

    return (
        <Button
            onClick={handleToggle}
            disabled={loading}
            className="w-full md:w-auto h-12 md:h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20"
        >
            {loading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
                <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Seguir Club
                </>
            )}
        </Button>
    );
}
