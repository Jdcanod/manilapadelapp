/**
 * Primera ronda del cuadro cuando clasifican por grupo (1ro y 2do de cada
 * grupo). Sin dependencias de servidor, para poder probarla sola.
 */
export interface BracketPlaceholderSeed {
    placeholder: string;
    grupoId: string;
    seed: number;
}

export function generatePlaceholdersForBracket(grupos: { id: string; nombre_grupo: string }[], porGrupo: number) {
    const totalClasificados = grupos.length * porGrupo;
    let targetTeams = 2;
    while (targetTeams < totalClasificados) targetTeams *= 2;
    const numByes = targetTeams - totalClasificados;

    const pot1: BracketPlaceholderSeed[] = grupos.map(g => ({
        placeholder: `1ro ${g.nombre_grupo}`,
        grupoId: g.id,
        seed: 1
    }));
    const pot2: BracketPlaceholderSeed[] = grupos.map(g => ({
        placeholder: `2do ${g.nombre_grupo}`,
        grupoId: g.id,
        seed: 2
    }));

    const seededGroupIds = new Set<string>();
    // Si hay byes, los mejores seeds de pot1 reciben byes. Para relámpago asumimos orden por grupo
    for (let i = 0; i < numByes; i++) {
        if (pot1[i]) seededGroupIds.add(pot1[i].grupoId);
    }

    const matchesData: { seed: BracketPlaceholderSeed; opponent: BracketPlaceholderSeed; invertir?: boolean }[] = [];
    if (grupos.length === 2 && porGrupo === 2) {
        // A1 vs B2, B1 vs A2
        matchesData.push({ seed: pot1[0], opponent: pot2[1] });
        matchesData.push({ seed: pot1[1], opponent: pot2[0] });
    } else if (grupos.length === 4 && porGrupo === 2) {
        // Cruce pedido por el club. Semifinales: llave 1 con la 2 y la 3 con
        // la 4. Nadie repite grupo en cuartos, y el 1ro y el 2do de cada grupo
        // quedan en mitades distintas: solo se pueden volver a ver en la final.
        // `invertir` respeta el orden en que el club lo escribe ("2B vs 1D").
        matchesData.push({ seed: pot1[0], opponent: pot2[2] });                 // Llave 1: 1A vs 2C
        matchesData.push({ seed: pot1[3], opponent: pot2[1], invertir: true }); // Llave 2: 2B vs 1D
        matchesData.push({ seed: pot1[2], opponent: pot2[0], invertir: true }); // Llave 3: 2A vs 1C
        matchesData.push({ seed: pot1[1], opponent: pot2[3], invertir: true }); // Llave 4: 2D vs 1B
    } else {
        // Cruzado por defecto
        for (let i = 0; i < grupos.length; i++) {
            const seed = pot1[i];
            const opponentIdx = grupos.length - 1 - i;
            const opponent = pot2[opponentIdx];
            matchesData.push({ seed, opponent });
        }
    }

    return {
        targetTeams,
        numByes,
        matchesData,
        seededGroupIds
    };
}
