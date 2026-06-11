import type { Stage } from "@prisma/client";
import { stageLabel } from "@/lib/format";

export type ReminderMatch = {
  stage: Stage;
  group: string | null;
  kickoff: Date;
  homeTeamName: string | null;
  awayTeamName: string | null;
};

export type DailyDeadlines = {
  windowStart: Date;
  windowEnd: Date;
  /** Matches kicking off in the window — each is a score-prediction deadline. */
  matches: ReminderMatch[];
  /** Groups whose standings predictions lock in the window (first kickoff in that group). */
  groups: { group: string; lock: Date }[];
  /** First R32 kickoff (R16 fallback), if it falls in the window. */
  bracketLock: Date | null;
  /** Last group's first kickoff — third-place qualifier picks lock then. */
  thirdPlaceLock: Date | null;
  /** First kickoff of the tournament — winner + Golden Boot lock then. */
  tournamentLock: Date | null;
};

export const REMINDER_WINDOW_HOURS = 24;

export function collectDailyDeadlines(
  matches: ReminderMatch[],
  now: Date
): DailyDeadlines {
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600_000);
  const inWindow = (d: Date) => d > windowStart && d <= windowEnd;

  const upcoming = matches
    .filter((m) => inWindow(m.kickoff))
    .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

  const groupFirstKickoff = new Map<string, Date>();
  let tournamentFirst: Date | null = null;
  let r32First: Date | null = null;
  let r16First: Date | null = null;
  for (const m of matches) {
    if (!tournamentFirst || m.kickoff < tournamentFirst) tournamentFirst = m.kickoff;
    if (m.stage === "GROUP" && m.group) {
      const cur = groupFirstKickoff.get(m.group);
      if (!cur || m.kickoff < cur) groupFirstKickoff.set(m.group, m.kickoff);
    }
    if (m.stage === "R32" && (!r32First || m.kickoff < r32First)) r32First = m.kickoff;
    if (m.stage === "R16" && (!r16First || m.kickoff < r16First)) r16First = m.kickoff;
  }

  const groups = [...groupFirstKickoff.entries()]
    .filter(([, lock]) => inWindow(lock))
    .map(([group, lock]) => ({ group, lock }))
    .sort((a, b) => a.lock.getTime() - b.lock.getTime() || a.group.localeCompare(b.group));

  // Third-place picks lock once every group has kicked off — the latest
  // group's first kickoff is the deadline.
  let lastGroupFirst: Date | null = null;
  for (const lock of groupFirstKickoff.values()) {
    if (!lastGroupFirst || lock > lastGroupFirst) lastGroupFirst = lock;
  }

  const bracketFirst = r32First ?? r16First;

  return {
    windowStart,
    windowEnd,
    matches: upcoming,
    groups,
    bracketLock: bracketFirst && inWindow(bracketFirst) ? bracketFirst : null,
    thirdPlaceLock:
      lastGroupFirst && inWindow(lastGroupFirst) ? lastGroupFirst : null,
    tournamentLock:
      tournamentFirst && inWindow(tournamentFirst) ? tournamentFirst : null,
  };
}

/**
 * Slack date token — renders in each viewer's own timezone, with a UTC
 * fallback for clients that can't expand it.
 */
function slackTime(d: Date): string {
  const ts = Math.floor(d.getTime() / 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fallback = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
  return `<!date^${ts}^{date_short_pretty} at {time}|${fallback}>`;
}

export type ReminderMessage = {
  text: string;
  blocks: Record<string, unknown>[];
};

export function buildReminderMessage(
  deadlines: DailyDeadlines,
  opts: { appUrl: string; imageUrl: string }
): ReminderMessage | null {
  const { matches, groups, bracketLock, thirdPlaceLock, tournamentLock } = deadlines;
  if (
    matches.length === 0 &&
    groups.length === 0 &&
    !bracketLock &&
    !thirdPlaceLock &&
    !tournamentLock
  ) {
    return null;
  }

  const lines: string[] = [
    ":soccer: *Heads up — today's prediction deadlines!*",
  ];

  if (matches.length > 0) {
    lines.push("", "*Match predictions* — lock at kickoff:");
    for (const m of matches) {
      lines.push(
        `• ${m.homeTeamName ?? "TBD"} vs ${m.awayTeamName ?? "TBD"} (${stageLabel(
          m.stage,
          m.group
        )}) — ${slackTime(m.kickoff)}`
      );
    }
  }

  const extras: string[] = [];
  for (const g of groups) {
    extras.push(`• Group ${g.group} standings — ${slackTime(g.lock)}`);
  }
  if (tournamentLock) {
    extras.push(
      `• :trophy: Tournament winner & Golden Boot — ${slackTime(tournamentLock)}`
    );
  }
  if (thirdPlaceLock) {
    extras.push(
      `• Best third-place qualifiers — ${slackTime(thirdPlaceLock)}`
    );
  }
  if (bracketLock) {
    extras.push(`• Knockout bracket — ${slackTime(bracketLock)}`);
  }
  if (extras.length > 0) {
    lines.push("", ":lock: *Also locking:*", ...extras);
  }

  lines.push("", `:crystal_ball: <${opts.appUrl}|Get your picks in →>`);

  const text = lines.join("\n");
  return {
    // Plain-text fallback drives the notification preview; blocks drive the
    // rendered message.
    text: "Today's prediction deadlines — get your picks in!",
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "image",
        image_url: opts.imageUrl,
        alt_text: "Current leaderboard top 3",
      },
    ],
  };
}
