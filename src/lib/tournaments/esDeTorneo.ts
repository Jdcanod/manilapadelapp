/**
 * ¿Este partido pertenece a un torneo?
 *
 * Había dos columnas diciendo lo mismo y no coincidían: `generarFaseGrupos`
 * —el generador de los partidos de grupo— escribía `tipo_partido_oficial`
 * pero no `tipo_partido`, así que 515 partidos de torneo quedaron marcados
 * con el valor por defecto de la base, "Amistoso".
 *
 * Preguntar por una sola de esas columnas daba respuestas falsas: el club no
 * podía pedir revancha ("Solo aplica a partidos de torneo") y, peor, la
 * pareja rival podía auto-confirmarse el resultado de un partido de torneo,
 * que es justo lo que ese control existía para impedir.
 *
 * La señal confiable es tener `torneo_id`: un partido que cuelga de un torneo
 * ES de torneo, lo diga como lo diga el resto de columnas.
 */
export interface PartidoPosibleDeTorneo {
    torneo_id?: string | null;
    tipo_partido?: string | null;
    tipo_partido_oficial?: string | null;
}

export function esPartidoDeTorneo(partido: PartidoPosibleDeTorneo): boolean {
    if (partido.torneo_id) return true;
    return partido.tipo_partido === 'torneo' || partido.tipo_partido_oficial === 'torneo';
}
