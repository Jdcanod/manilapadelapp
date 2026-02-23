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
        .select('id, rol, precio_hora_base, precio_fin_semana, canchas_activas_json, horarios_solo_90_min_json')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    const initialData = {
        userId: user.id,
        precio_hora_base: userData.precio_hora_base ?? 80000,
        precio_fin_semana: userData.precio_fin_semana ?? 100000,
        canchas_activas_json: userData.canchas_activas_json ?? { "1": true, "2": true, "3": true, "4": true },
        horarios_solo_90_min_json: userData.horarios_solo_90_min_json ?? [],
    };

    return <ConfigClubForm initialData={initialData} />;
}
