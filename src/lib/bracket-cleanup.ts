import { Stage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveR32Slots,
  type GroupPickLookup,
} from "@/lib/bracket-seeding";

// Walk the bracket round by round and delete any pick whose teamId isn't
// actually one of the two teams in that specific match. Cascading is essential
// — a stale R32 pick poisons the R16 pair fed from that slot, which poisons
// QF, etc. We resolve each round's expected teams using only the picks that
// have already been validated, so a deleted R32 pick wipes out everything
// downstream that depended on it.
export async function cleanupStaleBracketPicks(userId: string): Promise<void> {
  const [groupPreds, thirdPlacePicks, bracketPicks] = await Promise.all([
    prisma.groupPrediction.findMany({ where: { userId } }),
    prisma.thirdPlaceQualifierPick.findMany({
      where: { userId },
      select: { teamId: true },
    }),
    prisma.bracketPick.findMany({
      where: { userId },
      select: { round: true, slot: true, teamId: true },
    }),
  ]);

  // Re-derive the R32 seeding the same way the bracket page does — so our
  // notion of "who's in R32 slot N" matches what the UI displays.
  const groupPickMap = new Map<string, GroupPickLookup>();
  const thirdPlaceTeamToGroup = new Map<string, string>();
  for (const gp of groupPreds) {
    groupPickMap.set(gp.group, {
      group: gp.group,
      team1stId: gp.team1stId,
      team2ndId: gp.team2ndId,
      team3rdId: gp.team3rdId,
      team4thId: gp.team4thId,
    });
    thirdPlaceTeamToGroup.set(gp.team3rdId, gp.group);
  }
  const qualifierGroupByTeamId = new Map<string, string>();
  for (const p of thirdPlacePicks) {
    const group = thirdPlaceTeamToGroup.get(p.teamId);
    if (group) qualifierGroupByTeamId.set(p.teamId, group);
  }
  const r32 = resolveR32Slots(groupPickMap, qualifierGroupByTeamId);

  const pickByKey = new Map<string, string>();
  for (const p of bracketPicks) pickByKey.set(`${p.round}:${p.slot}`, p.teamId);

  // valid = picks we've kept so far. We use these to derive the next round's
  // contestants — discarded picks remove their downstream dependents.
  const valid = new Map<string, string>();
  const toDelete: { round: Stage; slot: number }[] = [];

  function validateOrDelete(
    round: Stage,
    slot: number,
    home: string | null,
    away: string | null
  ) {
    const key = `${round}:${slot}`;
    const pick = pickByKey.get(key);
    if (!pick) return;
    if (pick === home || pick === away) {
      valid.set(key, pick);
    } else {
      toDelete.push({ round, slot });
    }
  }

  // R32 — teams come straight from the seeding.
  for (const seed of r32) {
    validateOrDelete(Stage.R32, seed.slot, seed.homeId, seed.awayId);
  }
  // R16 — fed by R32 winners.
  for (let i = 0; i < 8; i++) {
    validateOrDelete(
      Stage.R16,
      i,
      valid.get(`R32:${i * 2}`) ?? null,
      valid.get(`R32:${i * 2 + 1}`) ?? null
    );
  }
  // QF — fed by R16 winners.
  for (let i = 0; i < 4; i++) {
    validateOrDelete(
      Stage.QF,
      i,
      valid.get(`R16:${i * 2}`) ?? null,
      valid.get(`R16:${i * 2 + 1}`) ?? null
    );
  }
  // SF — fed by QF winners.
  for (let i = 0; i < 2; i++) {
    validateOrDelete(
      Stage.SF,
      i,
      valid.get(`QF:${i * 2}`) ?? null,
      valid.get(`QF:${i * 2 + 1}`) ?? null
    );
  }
  // FINAL — SF winners.
  validateOrDelete(
    Stage.FINAL,
    0,
    valid.get("SF:0") ?? null,
    valid.get("SF:1") ?? null
  );
  // THIRD — the two SF losers (each: the QF winner in the pair that wasn't
  // the SF winner). If any upstream piece is missing, the loser is unknown
  // and the pick gets dropped.
  const loser = (qfA: string, qfB: string, sfWinner: string | undefined) => {
    if (!sfWinner) return null;
    if (sfWinner === qfA) return qfB;
    if (sfWinner === qfB) return qfA;
    return null;
  };
  const sf0Loser = loser(
    valid.get("QF:0") ?? "",
    valid.get("QF:1") ?? "",
    valid.get("SF:0")
  );
  const sf1Loser = loser(
    valid.get("QF:2") ?? "",
    valid.get("QF:3") ?? "",
    valid.get("SF:1")
  );
  validateOrDelete(Stage.THIRD, 0, sf0Loser, sf1Loser);

  if (toDelete.length === 0) return;
  await prisma.bracketPick.deleteMany({
    where: {
      userId,
      OR: toDelete.map((d) => ({ round: d.round, slot: d.slot })),
    },
  });
}
