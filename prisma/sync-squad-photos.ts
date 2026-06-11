/* eslint-disable no-console */
// Pull WC2026 squads from FIFA's JSON API and write player headshots to
// Player.photo. Run with:
//   pnpm tsx prisma/sync-squad-photos.ts
//
// FIFA's site (fifa.com) is backed by the public api.fifa.com v3 API — no auth.
// We read the 48-team list from the competition calendar, then each team's
// squad. Headshots come from digitalhub.fifa.com; we request a 320px square.
//
// FIFA publishes squad photos team-by-team in the run-up to the tournament, so
// some squads return players with no photo yet (PictureUrl null). Those players
// keep photo=null and render the on-brand initials chip from <PlayerAvatar>, so
// every player still shows an image — re-run later to pick up squads as their
// photos go live. Name matching lives in @/lib/squad-photos (unit-tested).

import { prisma } from "@/lib/prisma";
import { matchPlayer, normalizeName } from "@/lib/squad-photos";

const ID_COMPETITION = "17"; // FIFA World Cup
const ID_SEASON = "285023"; // 2026 — Canada / Mexico / USA
const API = "https://api.fifa.com/api/v3";
const HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json" };

type Localized = { Locale: string; Description: string }[];

function enText(items: Localized | null | undefined): string {
  if (!items || items.length === 0) return "";
  const en = items.find((i) => i.Locale.startsWith("en")) ?? items[0]!;
  return en.Description ?? "";
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${url} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

type FifaTeam = { id: string; name: string; country: string };

type CalendarResponse = {
  Results: { Home: TeamSide | null; Away: TeamSide | null }[];
};
type TeamSide = {
  IdTeam: string | null;
  IdCountry: string | null;
  TeamType: number | null;
  TeamName: Localized;
};

async function fetchTeams(): Promise<FifaTeam[]> {
  const data = await getJson<CalendarResponse>(
    `${API}/calendar/matches?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&count=500&language=en`
  );
  const byId = new Map<string, FifaTeam>();
  for (const match of data.Results) {
    for (const side of [match.Home, match.Away]) {
      // TeamType 1 = a real nation; knockout placeholders have null/other.
      if (side?.IdTeam && side.IdCountry && side.TeamType === 1) {
        byId.set(side.IdTeam, {
          id: side.IdTeam,
          name: enText(side.TeamName),
          country: side.IdCountry,
        });
      }
    }
  }
  return [...byId.values()];
}

type FifaPlayer = { name: string; photoUrl: string };

type SquadResponse = {
  Players: {
    PlayerName: Localized;
    PictureUrl: string | null;
    PlayerPicture: { PictureUrl: string | null } | null;
  }[];
};

function headshotUrl(base: string): string {
  return `${base}?io=transform:fill,aspectratio:1x1,width:320&quality=75`;
}

async function fetchSquad(teamId: string): Promise<FifaPlayer[]> {
  const data = await getJson<SquadResponse>(
    `${API}/teams/${teamId}/squad?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&language=en`
  );
  const out: FifaPlayer[] = [];
  for (const p of data.Players ?? []) {
    const base = p.PlayerPicture?.PictureUrl ?? p.PictureUrl;
    const name = enText(p.PlayerName);
    if (!base || !name) continue;
    out.push({ name, photoUrl: headshotUrl(base) });
  }
  return out;
}

async function main() {
  console.log("Fetching team list from FIFA…");
  const fifaTeams = await fetchTeams();
  console.log(`  → ${fifaTeams.length} teams in the competition`);

  const dbTeams = await prisma.team.findMany({
    include: { players: { select: { id: true, name: true } } },
  });
  // FIFA's IdCountry matches our Team.code for most teams; fall back to name.
  const byCode = new Map(dbTeams.map((t) => [t.code.toUpperCase(), t]));
  const byName = new Map(dbTeams.map((t) => [normalizeName(t.name), t]));
  const findDbTeam = (ft: FifaTeam) =>
    byCode.get(ft.country.toUpperCase()) ?? byName.get(normalizeName(ft.name));

  let matchedTeams = 0;
  let teamsWithPhotos = 0;
  let totalScraped = 0;
  let totalUpdated = 0;

  for (const ft of fifaTeams) {
    const dbTeam = findDbTeam(ft);
    if (!dbTeam) {
      console.log(`  · ${ft.name} (${ft.country}): no matching team in DB, skipping`);
      continue;
    }
    matchedTeams++;
    process.stdout.write(`  · ${ft.name}… `);

    let squad: FifaPlayer[] = [];
    try {
      squad = await fetchSquad(ft.id);
    } catch (err) {
      console.log(`failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (squad.length === 0) {
      console.log(`no photos published yet`);
      continue;
    }
    teamsWithPhotos++;
    totalScraped += squad.length;

    let updated = 0;
    for (const fp of squad) {
      const dbPlayer = matchPlayer(fp.name, dbTeam.players);
      if (!dbPlayer) continue;
      await prisma.player.update({
        where: { id: dbPlayer.id },
        data: { photo: fp.photoUrl, fifaName: fp.name },
      });
      updated++;
    }
    totalUpdated += updated;
    console.log(`${squad.length} with photos, ${updated} matched (DB roster: ${dbTeam.players.length})`);
  }

  const [totalPlayers, withoutPhoto] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { photo: null } }),
  ]);

  console.log(`\nSummary`);
  console.log(`  teams in competition:   ${fifaTeams.length}`);
  console.log(`  teams matched in DB:    ${matchedTeams}`);
  console.log(`  teams with FIFA photos: ${teamsWithPhotos}`);
  console.log(`  FIFA headshots seen:    ${totalScraped}`);
  console.log(`  Player.photo updates:   ${totalUpdated}`);
  console.log(`  players with a photo:   ${totalPlayers - withoutPhoto}/${totalPlayers}`);
  if (withoutPhoto > 0) {
    console.log(
      `  ${withoutPhoto} player(s) have no FIFA photo yet — they render the initials avatar.`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
