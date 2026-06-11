import { describe, expect, it } from "vitest";
import {
  buildReminderMessage,
  collectDailyDeadlines,
  type ReminderMatch,
} from "@/lib/deadline-reminders";

const NOW = new Date("2026-06-12T09:00:00Z");

function match(over: Partial<ReminderMatch>): ReminderMatch {
  return {
    stage: "GROUP",
    group: "A",
    kickoff: new Date("2026-06-12T19:00:00Z"),
    homeTeamName: "Mexico",
    awayTeamName: "South Africa",
    ...over,
  };
}

describe("collectDailyDeadlines", () => {
  it("returns matches kicking off within the next 24h, sorted by kickoff", () => {
    const inWindowLate = match({
      group: "B",
      kickoff: new Date("2026-06-13T02:00:00Z"),
      homeTeamName: "South Korea",
      awayTeamName: "Czechia",
    });
    const inWindowEarly = match({});
    const tooFar = match({ kickoff: new Date("2026-06-13T19:00:00Z") });
    const past = match({ kickoff: new Date("2026-06-12T08:00:00Z") });

    const d = collectDailyDeadlines([tooFar, inWindowLate, past, inWindowEarly], NOW);
    expect(d.matches.map((m) => m.homeTeamName)).toEqual(["Mexico", "South Korea"]);
  });

  it("excludes a kickoff exactly at now — that deadline has already passed", () => {
    const d = collectDailyDeadlines([match({ kickoff: NOW })], NOW);
    expect(d.matches).toHaveLength(0);
  });

  it("reports a group lock only on the day of that group's first kickoff", () => {
    const groupA = [
      match({}),
      match({ kickoff: new Date("2026-06-15T19:00:00Z") }),
    ];
    const groupCFirstTomorrow = match({
      group: "C",
      kickoff: new Date("2026-06-13T19:00:00Z"),
    });

    const d = collectDailyDeadlines([...groupA, groupCFirstTomorrow], NOW);
    expect(d.groups).toEqual([
      { group: "A", lock: new Date("2026-06-12T19:00:00Z") },
    ]);
  });

  it("reports tournament lock (winner/golden boot) only when the first kickoff is in window", () => {
    const opener = match({});
    const d1 = collectDailyDeadlines([opener], NOW);
    expect(d1.tournamentLock).toEqual(opener.kickoff);

    const dayTwo = collectDailyDeadlines(
      [match({ kickoff: new Date("2026-06-11T19:00:00Z") }), match({ group: "B" })],
      NOW
    );
    expect(dayTwo.tournamentLock).toBeNull();
  });

  it("third-place lock is the LAST group's first kickoff", () => {
    const d = collectDailyDeadlines(
      [
        match({ kickoff: new Date("2026-06-11T19:00:00Z") }),
        match({ group: "L", kickoff: new Date("2026-06-12T22:00:00Z") }),
      ],
      NOW
    );
    expect(d.thirdPlaceLock).toEqual(new Date("2026-06-12T22:00:00Z"));
  });

  it("bracket lock uses first R32 kickoff and falls back to R16", () => {
    const r32 = match({
      stage: "R32",
      group: null,
      kickoff: new Date("2026-06-12T16:00:00Z"),
    });
    expect(collectDailyDeadlines([r32], NOW).bracketLock).toEqual(r32.kickoff);

    const r16 = match({
      stage: "R16",
      group: null,
      kickoff: new Date("2026-06-12T16:00:00Z"),
    });
    expect(collectDailyDeadlines([r16], NOW).bracketLock).toEqual(r16.kickoff);

    const r16TooFar = match({
      stage: "R16",
      group: null,
      kickoff: new Date("2026-06-20T16:00:00Z"),
    });
    expect(collectDailyDeadlines([r16TooFar], NOW).bracketLock).toBeNull();
  });
});

describe("buildReminderMessage", () => {
  const opts = {
    appUrl: "https://example.test",
    imageUrl: "https://example.test/api/reminder-card?d=2026-06-12",
  };

  it("returns null when nothing locks in the window", () => {
    const d = collectDailyDeadlines(
      [match({ kickoff: new Date("2026-06-20T19:00:00Z") })],
      NOW
    );
    expect(buildReminderMessage(d, opts)).toBeNull();
  });

  it("lists every deadline kind with viewer-local Slack date tokens", () => {
    const d = collectDailyDeadlines(
      [
        match({}),
        match({ group: "L", kickoff: new Date("2026-06-13T02:00:00Z") }),
      ],
      NOW
    );
    const msg = buildReminderMessage(d, opts);
    expect(msg).not.toBeNull();
    const text = JSON.stringify(msg!.blocks);
    expect(text).toContain("Mexico vs South Africa");
    expect(text).toContain("Group A");
    // Slack date token renders in each viewer's local timezone.
    expect(text).toContain("<!date^1781290800^{date_short_pretty} at {time}|");
    expect(text).toContain("Tournament winner & Golden Boot");
    expect(text).toContain("Group A standings");
    expect(text).toContain("Group L standings");
    expect(text).toContain("Best third-place qualifiers");
    expect(text).toContain(opts.appUrl);
  });

  it("attaches the leaderboard card image", () => {
    const msg = buildReminderMessage(collectDailyDeadlines([match({})], NOW), opts);
    const image = msg!.blocks.find((b) => b.type === "image");
    expect(image).toMatchObject({ image_url: opts.imageUrl });
  });

  it("omits the knockout-bracket line during the group stage", () => {
    const msg = buildReminderMessage(collectDailyDeadlines([match({})], NOW), opts);
    expect(JSON.stringify(msg!.blocks)).not.toContain("Knockout bracket");
  });
});
