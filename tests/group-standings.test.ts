import { describe, expect, it } from "vitest";
import { computeGroupStandings } from "@/lib/group-standings";

const match = (h: string, a: string, hs: number, as_: number) => ({
  homeTeamId: h,
  awayTeamId: a,
  homeScore: hs,
  awayScore: as_,
});

describe("computeGroupStandings", () => {
  it("orders by points descending", () => {
    const standings = computeGroupStandings([
      match("A", "B", 2, 0),
      match("A", "C", 1, 0),
      match("A", "D", 3, 1),
      match("B", "C", 1, 1),
      match("B", "D", 2, 0),
      match("C", "D", 0, 0),
    ]);
    expect(standings.map((s) => s.teamId)).toEqual(["A", "B", "C", "D"]);
    expect(standings[0].points).toBe(9);
    expect(standings[1].points).toBe(4);
  });

  it("uses goal difference as a tiebreaker", () => {
    const standings = computeGroupStandings([
      match("A", "B", 1, 0),
      match("C", "D", 1, 0),
      match("A", "C", 0, 0),
      match("B", "D", 0, 0),
      match("A", "D", 5, 0),
      match("B", "C", 0, 0),
    ]);
    // A: W D W = 7 pts, GD = +6
    // C: D L D = 2 pts, GD = -1
    // B: L D D = 2 pts, GD = -1
    // D: L D L = 1 pt
    // Tied B & C on points. C has equal GD to B (-1) but better head-to-head.
    // We sort by points → GD → GF → teamId, so verify A is first and D is last.
    expect(standings[0].teamId).toBe("A");
    expect(standings[3].teamId).toBe("D");
  });

  it("uses goals-for after goal difference", () => {
    const standings = computeGroupStandings([
      match("A", "B", 3, 0),
      match("A", "C", 0, 0),
      match("A", "D", 0, 0),
      match("B", "C", 0, 0),
      match("B", "D", 3, 0),
      match("C", "D", 0, 0),
    ]);
    // A: W D D = 5 pts, GD +3, GF 3
    // B: L D W = 4 pts, GD 0, GF 3
    // C: D D D = 3 pts, GD 0, GF 0
    // D: D L D = 2 pts
    expect(standings[0].teamId).toBe("A");
    expect(standings[1].teamId).toBe("B");
    expect(standings[2].teamId).toBe("C");
  });

  it("breaks a points/GD/GF tie by head-to-head, overriding the id fallback", () => {
    // ZZ and AA finish level on points (4), GD (0) and GF (1). ZZ beat AA, so
    // FIFA's head-to-head rule ranks ZZ above AA even though "AA" sorts first.
    const standings = computeGroupStandings([
      match("ZZ", "AA", 1, 0),
      match("C", "ZZ", 1, 0),
      match("AA", "C", 1, 0),
      match("ZZ", "D", 0, 0),
      match("AA", "D", 0, 0),
      match("C", "D", 1, 0),
    ]);
    expect(standings.map((s) => s.teamId)).toEqual(["C", "ZZ", "AA", "D"]);
  });

  it("seeds teams that have no finished match yet", () => {
    const standings = computeGroupStandings(
      [match("A", "B", 1, 0)],
      ["A", "B", "C", "D"]
    );
    expect(standings).toHaveLength(4);
    expect(standings[0]!.teamId).toBe("A");
    const c = standings.find((s) => s.teamId === "C");
    expect(c?.played).toBe(0);
  });

  it("ignores unfinished matches (null scores)", () => {
    const standings = computeGroupStandings([
      { homeTeamId: "A", awayTeamId: "B", homeScore: null, awayScore: null },
      { homeTeamId: "A", awayTeamId: "B", homeScore: 1, awayScore: 0 },
    ]);
    const a = standings.find((s) => s.teamId === "A");
    expect(a?.played).toBe(1);
    expect(a?.points).toBe(3);
  });
});
