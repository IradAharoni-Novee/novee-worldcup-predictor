// Pull WC2026 squads from FIFA's public JSON API and write player headshots to
// Player.photo. Used by the daily cron (src/app/api/cron/sync) and the manual
// script (prisma/sync-squad-photos.ts).
//
// FIFA's site (fifa.com) is backed by api.fifa.com v3 — no auth. We read the
// 48-team list from the competition calendar, then each team's squad, taking
// the headshot straight from PlayerPicture.PictureUrl. FIFA publishes squad
// photos team-by-team in the run-up to the tournament, so some squads return
// players with no photo yet; those keep photo=null and render the on-brand
// initials chip from <PlayerAvatar>. Re-running picks up squads as they go live.

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

type TeamSide = {
  IdTeam: string | null;
  IdCountry: string | null;
  TeamType: number | null;
  TeamName: Localized;
};
type CalendarResponse = {
  Results: { Home: TeamSide | null; Away: TeamSide | null }[];
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

export type FifaPlayer = { name: string; photoUrl: string };

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

export type SquadPhotoSyncResult = {
  teamsTotal: number;
  teamsMatched: number;
  teamsWithPhotos: number;
  headshotsSeen: number;
  photoUpdates: number;
  playersWithPhoto: number;
  playersTotal: number;
};

type ProgressFn = (line: string) => void;

export async function syncSquadPhotosFromFifa(
  onProgress: ProgressFn = () => {}
): Promise<SquadPhotoSyncResult> {
  const fifaTeams = await fetchTeams();
  onProgress(`${fifaTeams.length} teams in the competition`);

  const dbTeams = await prisma.team.findMany({
    include: { players: { select: { id: true, name: true } } },
  });
  // FIFA's IdCountry matches our Team.code for most teams; fall back to name.
  const byCode = new Map(dbTeams.map((t) => [t.code.toUpperCase(), t]));
  const byName = new Map(dbTeams.map((t) => [normalizeName(t.name), t]));
  const findDbTeam = (ft: FifaTeam) =>
    byCode.get(ft.country.toUpperCase()) ?? byName.get(normalizeName(ft.name));

  let teamsMatched = 0;
  let teamsWithPhotos = 0;
  let headshotsSeen = 0;
  let photoUpdates = 0;

  for (const ft of fifaTeams) {
    const dbTeam = findDbTeam(ft);
    if (!dbTeam) {
      onProgress(`${ft.name} (${ft.country}): no matching team in DB, skipping`);
      continue;
    }
    teamsMatched++;

    let squad: FifaPlayer[];
    try {
      squad = await fetchSquad(ft.id);
    } catch (err) {
      onProgress(`${ft.name}: failed — ${err instanceof Error ? err.message : err}`);
      continue;
    }
    if (squad.length === 0) {
      onProgress(`${ft.name}: no photos published yet`);
      continue;
    }
    teamsWithPhotos++;
    headshotsSeen += squad.length;

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
    photoUpdates += updated;
    onProgress(
      `${ft.name}: ${squad.length} with photos, ${updated} matched (DB roster: ${dbTeam.players.length})`
    );
  }

  const [playersTotal, withoutPhoto] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { photo: null } }),
  ]);

  return {
    teamsTotal: fifaTeams.length,
    teamsMatched,
    teamsWithPhotos,
    headshotsSeen,
    photoUpdates,
    playersWithPhoto: playersTotal - withoutPhoto,
    playersTotal,
  };
}
