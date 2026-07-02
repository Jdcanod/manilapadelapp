"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { useState } from "react";
import { getFollowData } from "@/app/(dashboard)/novedades/social-actions";

interface FollowersModalProps {
    userId: string;
    isClub: boolean;
    followersCount: number;
    followingCount: number;
    customTrigger?: React.ReactNode;
}

export function FollowersModal({ userId, isClub, followersCount, followingCount, customTrigger }: FollowersModalProps) {
    const [open, setOpen] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [followers, setFollowers] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [following, setFollowing] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const handleOpenChange = async (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            setLoading(true);
            try {
                const data = await getFollowData(userId, isClub);
                setFollowers(data.followers);
                setFollowing(data.following);
            } catch (error) {
                console.error("Error fetching follow data", error);
            } finally {
                setLoading(false);
            }
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderList = (list: any[], emptyMessage: string) => {
        if (loading) {
            return <div className="text-center py-8 text-neutral-500 animate-pulse">Cargando...</div>;
        }

        if (list.length === 0) {
            return <div className="text-center py-8 text-neutral-500">{emptyMessage}</div>;
        }

        return (
            <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                    {list.map((u) => {
                        const iniciales = (u.nombre || "User").substring(0, 2).toUpperCase();
                        const isClubUser = u.rol === 'admin_club';
                        const url = isClubUser ? `/clubes/${u.id}` : `/jugador/${u.id}`;
                        
                        return (
                            <Link key={u.id} href={url} onClick={() => setOpen(false)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-neutral-800 transition-colors">
                                <Avatar className="w-10 h-10 border border-neutral-700">
                                    <AvatarFallback className="bg-emerald-600 text-white font-bold text-xs">{iniciales}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <h4 className="font-bold text-white text-sm truncate">{u.nombre}</h4>
                                    <p className="text-xs text-neutral-400 capitalize truncate">
                                        {isClubUser ? 'Club' : (u.categoria || u.nivel || 'Jugador')}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </ScrollArea>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {customTrigger ? customTrigger : (
                    <button className="flex gap-4 text-sm mr-2 hover:bg-neutral-800/50 p-2 rounded-xl transition-colors text-left">
                        <div className="text-center">
                            <div className="font-bold text-white text-lg">{followersCount || 0}</div>
                            <div className="text-neutral-500">Seguidores</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-white text-lg">{followingCount || 0}</div>
                            <div className="text-neutral-500">Seguidos</div>
                        </div>
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl font-black">Conexiones</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="seguidores" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-2 bg-neutral-950 border-neutral-800">
                        <TabsTrigger value="seguidores" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-emerald-400 font-bold">Seguidores</TabsTrigger>
                        <TabsTrigger value="seguidos" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-emerald-400 font-bold">Seguidos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="seguidores" className="mt-4">
                        {renderList(followers, "Aún no hay seguidores.")}
                    </TabsContent>
                    <TabsContent value="seguidos" className="mt-4">
                        {renderList(following, "Aún no sigue a nadie.")}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
