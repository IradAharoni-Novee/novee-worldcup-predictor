import { Stage } from "@prisma/client";
import type { ProjectedSlot } from "@/lib/r32-projection";

export type StoredPick = { round: Stage; slot: number; teamId: string };

export type ReconcileResult = {
  // Picks that are still consistent with the live bracket, in input order.
  valid: StoredPick[];
  // R32 slots whose saved winner is no longer one of the two teams now in the
  // match (the projection moved since the pick was made) — surfaced in the UI so
  // the user re-picks. Nothing is deleted here; the next save persists `valid`.
  staleR32Slots: number[];
};

// Validate a user's bracket against the live-projected Round of 32, cascading
// round by round: an R32 winner that's no longer in its match is dropped, which
// invalidates the R16 pair it fed, and so on up to the final. Pure — the bracket
// page calls this at render and passes the result to the form.
export function reconcileBracketPicks(
  r32: ProjectedSlot[],
  picks: StoredPick[]
): ReconcileResult {
  const pickByKey = new Map<string, string>();
  for (const p of picks) pickByKey.set(`${p.round}:${p.slot}`, p.teamId);

  const valid = new Map<string, string>();
  const staleR32Slots: number[] = [];

  const keep = (
    round: Stage,
    slot: number,
    home: string | null,
    away: string | null
  ): void => {
    const key = `${round}:${slot}`;
    const pick = pickByKey.get(key);
    if (!pick) return;
    if (pick === home || pick === away) valid.set(key, pick);
    else if (round === Stage.R32 && (home || away)) staleR32Slots.push(slot);
  };

  for (const s of r32) keep(Stage.R32, s.slot, s.homeId, s.awayId);
  for (let i = 0; i < 8; i++) {
    keep(Stage.R16, i, valid.get(`R32:${i * 2}`) ?? null, valid.get(`R32:${i * 2 + 1}`) ?? null);
  }
  for (let i = 0; i < 4; i++) {
    keep(Stage.QF, i, valid.get(`R16:${i * 2}`) ?? null, valid.get(`R16:${i * 2 + 1}`) ?? null);
  }
  for (let i = 0; i < 2; i++) {
    keep(Stage.SF, i, valid.get(`QF:${i * 2}`) ?? null, valid.get(`QF:${i * 2 + 1}`) ?? null);
  }
  keep(Stage.FINAL, 0, valid.get("SF:0") ?? null, valid.get("SF:1") ?? null);

  // Third-place play-off: the two semi-final losers.
  const loser = (a: string, b: string, w: string | undefined): string | null => {
    if (!w) return null;
    if (w === a) return b;
    if (w === b) return a;
    return null;
  };
  const sf0Loser = loser(valid.get("QF:0") ?? "", valid.get("QF:1") ?? "", valid.get("SF:0"));
  const sf1Loser = loser(valid.get("QF:2") ?? "", valid.get("QF:3") ?? "", valid.get("SF:1"));
  keep(Stage.THIRD, 0, sf0Loser, sf1Loser);

  const out: StoredPick[] = [];
  for (const p of picks) {
    if (valid.get(`${p.round}:${p.slot}`) === p.teamId) out.push(p);
  }
  return { valid: out, staleR32Slots };
}
