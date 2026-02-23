import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ConfigClubForm } from "./ConfigClubForm";

export default async function ConfigClubPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol, precio_hora_base, precio_fin_semana, bloque_tiempo_minutos, canchas_activas_json')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    const initialData = {
        userId: user.id,
        precio_hora_base: userData.precio_hora_base ?? 80000,
        precio_fin_semana: userData.precio_fin_semana ?? 100000,
        bloque_tiempo_minutos: userData.bloque_tiempo_minutos ?? 90,
        canchas_activas_json: userData.canchas_activas_json ?? { "1": true, "2": true, "3": true, "4": true },
    };

    return <ConfigClubForm initialData={initialData} />;
}
