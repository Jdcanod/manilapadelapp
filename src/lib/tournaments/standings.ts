
interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    sg: number;
    sp: number;
    gg: number;
    gp: number;
    pts: number;
}

export function calculateStandings(matches: { 
    pareja1_id: string | null; 
    pareja2_id: string | null; 
    estado: string; 
    resultado: string | null; 
    estado_resultado: string | null; 
    pareja1?: { nombre_pareja: string | null } | null;
    pareja2?: { nombre_pareja: string | null } | null;
}[]): Standing[] {
    const map = new Map<string, Standing>();

    matches.forEach(m => {
        if (!m.pareja1_id || !m.pareja2_id) return;
        
        if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, nombre: m.pareja1?.nombre_pareja || "TBD", pj: 0, pg: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0 });
        if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, nombre: m.pareja2?.nombre_pareja || "TBD", pj: 0, pg: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0 });

        if ((m.estado === 'jugado' || m.estado_resultado === 'confirmado') && m.resultado) {
            const s1 = map.get(m.pareja1_id)!;
            const s2 = map.get(m.pareja2_id)!;
            
            s1.pj += 1;
            s2.pj += 1;

            const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
            let setsP1InMatch = 0; 
            let setsP2InMatch = 0;
            
            sets.forEach((set: number[]) => {
                if (set.length === 2 && !isNaN(set[0]) && !isNaN(set[1])) {
                    // Sumar games (No sumar si es un Super Tie-break, usualmente definido por puntuación >= 10)
                    if (set[0] < 10 && set[1] < 10) {
                        s1.gg += set[0];
                        s1.gp += set[1];
                        s2.gg += set[1];
                        s2.gp += set[0];
                    }

                    // Sumar sets
                    if (set[0] > set[1]) {
                        setsP1InMatch++;
                        s1.sg++;
                        s2.sp++;
                    } else if (set[1] > set[0]) {
                        setsP2InMatch++;
                        s2.sg++;
                        s1.sp++;
                    }
                }
            });

            if (setsP1InMatch > setsP2InMatch) {
                s1.pg += 1;
                s1.pts += 3;
            } else if (setsP2InMatch > setsP1InMatch) {
                s2.pg += 1;
                s2.pts += 3;
            }
        }
    });

    return Array.from(map.values()).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        
        // % Sets
        const totalSetsA = a.sg + a.sp;
        const totalSetsB = b.sg + b.sp;
        const pctSetsA = totalSetsA > 0 ? (a.sg * 100) / totalSetsA : 0;
        const pctSetsB = totalSetsB > 0 ? (b.sg * 100) / totalSetsB : 0;
        if (pctSetsB !== pctSetsA) return pctSetsB - pctSetsA;

        // % Games
        const totalGamesA = a.gg + a.gp;
        const totalGamesB = b.gg + b.gp;
        const pctGamesA = totalGamesA > 0 ? (a.gg * 100) / totalGamesA : 0;
        const pctGamesB = totalGamesB > 0 ? (b.gg * 100) / totalGamesB : 0;
        return pctGamesB - pctGamesA;
    });
}
