import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Star, Navigation } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ClubesMapPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('rol')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol === 'admin_club') {
        redirect("/club");
    }

    const { data: clubesDb } = await supabase
        .from('users')
        .select('id, nombre, canchas_activas_json, auth_id')
        .eq('rol', 'admin_club')
        .neq('rol', 'superadmin');

    const clubesMap = (clubesDb || []).map((c, i) => {
        const canchas = Array.isArray(c.canchas_activas_json) ? c.canchas_activas_json.length : 4;
        return {
            id: c.auth_id || (c.id ? c.id.toString() : "0"), // we use auth_id as the canonical user ID across the app, or we can use id
            name: c.nombre || "Club Padel",
            address: "Manizales, Caldas",
            courts: canchas,
            rating: 4.8 + (i * 0.1 % 0.2), // Mocking some rating rating
            status: "Abierto",
            coors: {
                x: 20 + ((i * 37) % 60),
                y: 20 + ((i * 29) % 60)
            } // Random-ish mock coordinates
        };
    });

    return (
        <div className="space-y-6 h-full flex flex-col md:h-[calc(100vh-100px)]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ink mb-1">Mapa de Clubes</h1>
                    <p className="text-olive">Descubre las mejores canchas de pádel en Manizales.</p>
                </div>
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-olive/70" />
                    <Input
                        placeholder="Buscar por zona o club..."
                        className="pl-9 bg-paper-soft/80 border-olive/20 text-ink w-full sm:w-[300px]"
                    />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-1 h-full min-h-[500px]">
                {/* Interactive Map Area (Mock Visual) */}
                <Card className="flex-1 bg-paper-soft border-olive/20 shadow-xl overflow-hidden relative">
                    {/* Faux map background gradient to look like geography */}
                    <div className="absolute inset-0 bg-paper">
                        <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=Manizales,Colombia&zoom=13&size=800x800&maptype=roadmap&style=feature:all|element:labels.text.fill|color:0xffffff&style=feature:all|element:labels.text.stroke|color:0x000000&style=feature:all|element:labels.icon|visibility:off&style=feature:administrative|element:geometry.fill|color:0x000000&style=feature:administrative|element:geometry.stroke|color:0x144b53&style=feature:landscape|element:geometry|color:0x08304b&style=feature:poi|element:geometry|color:0x0c4152&style=feature:road.highway|element:geometry.fill|color:0x000000&style=feature:road.highway|element:geometry.stroke|color:0x0b434f&style=feature:road.arterial|element:geometry|color:0x000000&style=feature:road.local|element:geometry|color:0x000000&style=feature:transit|element:geometry|color:0x146474&style=feature:water|element:geometry|color:0x021019')] bg-cover bg-center opacity-40 mix-blend-luminosity grayscale" />
                    </div>

                    <div className="absolute top-4 left-4 z-10 bg-paper/80 backdrop-blur-md px-4 py-2 rounded-full border border-olive/20 text-sm font-medium text-olive">
                        Vista Manizales
                    </div>

                    {/* Map Pins */}
                    {clubesMap.map((club) => (
                        <Link
                            href={`/clubes/${club.id}`}
                            key={club.id}
                            className="absolute z-20 group -translate-x-1/2 -translate-y-full hover:z-30 cursor-pointer block"
                            style={{ left: `${club.coors.x}%`, top: `${club.coors.y}%` }}
                        >
                            <div className="relative">
                                {/* Pin Pulse */}
                                {club.status === "Abierto" && (
                                    <div className="absolute -inset-2 bg-olive/30 rounded-full blur animate-ping shadow-lg shadow-emerald-500/50" />
                                )}
                                {/* Pin Body */}
                                <div className={`p-2 rounded-full border-2 bg-paper shadow-xl relative z-10 transition-transform group-hover:scale-110 ${club.status === "Abierto" ? 'border-olive' : 'border-neutral-600'
                                    }`}>
                                    <Navigation className={`w-5 h-5 ${club.status === "Abierto" ? 'text-olive' : 'text-olive/70'}`} />
                                </div>

                                {/* Pin Tooltip/Card */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-paper-soft border border-olive/30 w-[220px] rounded-xl p-3 shadow-2xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all origin-bottom">
                                    <h4 className="font-bold text-ink text-sm truncate">{club.name}</h4>
                                    <p className="text-xs text-olive mt-1 line-clamp-1">{club.address}</p>
                                    <div className="flex items-center justify-between mt-3 text-xs">
                                        <span className="flex items-center font-medium text-ochre-dark"><Star className="w-3 h-3 mr-1 fill-amber-500" /> {club.rating}</span>
                                        <span className="text-ink">{club.courts} canchas</span>
                                    </div>
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-paper-soft border-b border-r border-olive/30 rotate-45" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </Card>

                <div className="w-full md:w-[350px] flex flex-col gap-4 overflow-y-auto pr-2 pb-20 md:pb-0">
                    {clubesMap.map((club) => (
                        <Link href={`/clubes/${club.id}`} key={club.id} className="block">
                            <Card className="bg-paper-soft border-olive/20 hover:border-olive/30 hover:bg-paper-dark/50 transition-all cursor-pointer group">
                                <CardContent className="p-4 flex gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-paper-dark border border-olive/30 shrink-0 overflow-hidden relative">
                                        {/* Imagen de club simulada */}
                                        <div className="absolute inset-0 bg-olive/20 mix-blend-multiply" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-ink text-sm group-hover:text-olive transition-colors line-clamp-1">{club.name}</h3>
                                            {club.status === "Abierto" ? (
                                                <span className="w-2 h-2 rounded-full bg-olive shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                            ) : (
                                                <span className="w-2 h-2 rounded-full bg-neutral-600" />
                                            )}
                                        </div>
                                        <p className="text-xs text-olive flex items-center mb-2 line-clamp-1">
                                            <MapPin className="w-3 h-3 mr-1 shrink-0" /> {club.address}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-paper border-olive/20 text-ink">
                                                {club.courts} Canchas
                                            </Badge>
                                            <span className="text-xs flex items-center text-ochre-dark font-bold">
                                                <Star className="w-3 h-3 mr-0.5" /> {club.rating}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}

                    <Button variant="outline" className="w-full border-dashed border-olive/30 text-olive hover:text-ink mt-2">
                        Ver todos los clubes
                    </Button>
                </div>
            </div>
        </div>
    );
}
