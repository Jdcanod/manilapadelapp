import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { datosDePareja, datosDeJugador } from "@/lib/parejas/panel";

export const dynamic = 'force-dynamic';

/**
 * Datos del panel de pareja o de jugador.
 *
 * Exige sesión y nada más: club y jugador ven lo mismo. Lo único que cambia
 * según quién pregunta es el bloque de cara a cara, y eso lo resuelve la capa
 * de datos a partir del `viewerId` — no hay una variante por rol.
 *
 * No existe acceso anónimo: quien no tiene cuenta no ve nada, y el club le
 * responde de viva voz.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const torneoId = searchParams.get('torneo');
    const parejaId = searchParams.get('pareja');
    const jugadorId = searchParams.get('jugador');

    if (!torneoId || (!parejaId && !jugadorId)) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Sin sesión' }, { status: 401 });
    }

    const { data: perfil } = await supabase
        .from('users').select('id').eq('auth_id', user.id).single();
    const viewerId = perfil?.id ?? null;

    try {
        const datos = jugadorId
            ? await datosDeJugador(jugadorId, torneoId, viewerId)
            : await datosDePareja(parejaId!, torneoId, viewerId);

        if (!datos) {
            return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
        }
        return NextResponse.json(datos);
    } catch (e) {
        console.error('[panel]', e);
        return NextResponse.json({ error: 'No se pudo cargar el historial' }, { status: 500 });
    }
}
