import { distributeParticipantsIntoGroups, generateMatchesForGroup } from "./src/lib/tournaments/logic";

const participants = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    nombre: `Player ${i + 1}`,
    ranking: 100 - i
}));

const groups = distributeParticipantsIntoGroups(participants);
console.log("Groups:", JSON.stringify(groups, null, 2));

groups.forEach((g, i) => {
    const matches = generateMatchesForGroup(`g${i}`, g.map(p => p.id as string), "t1");
    console.log(`Matches for group ${i}:`, matches);
});
