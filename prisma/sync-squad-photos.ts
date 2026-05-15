/* eslint-disable no-console */
// Scrape FIFA's tournament squad pages for player photos and write them back
// to Player.photo. Run with:
//   pnpm tsx prisma/sync-squad-photos.ts                  # default: canadamexicousa2026
//   pnpm tsx prisma/sync-squad-photos.ts qatar2022        # back-test against past tournament
//
// FIFA serves player headshots from digitalhub.fifa.com via this pattern:
//   https://digitalhub.fifa.com/transform/<GUID>/<filename>?...&width:<N>&quality=75
// The squad pages list each player with an img.alt of "Firstname LASTNAME" and
// an img.srcset containing five widths. We pick the 320w variant.

import { chromium, type Page } from "@playwright/test";
import { prisma } from "@/lib/prisma";

const TOURNAMENT = process.argv[2] || "canadamexicousa2026";
const BASE = `https://www.fifa.com/en/tournaments/mens/worldcup/${TOURNAMENT}`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

type FifaPlayer = { name: string; photoUrl: string };

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-zA-Z]+/g, " ")
    .trim()
    .toUpperCase();
}

function pickWidth(srcset: string, preferredWidth: number): string | null {
  // srcset entries are "<url> <width>w" separated by commas, but the URLs
  // themselves contain commas (e.g. "transform:fill,aspectratio:1x1,...").
  // Match url+width pairs directly instead of splitting on commas.
  const matches = [
    ...srcset.matchAll(/(https?:\/\/\S+?)\s+(\d+)w(?=\s*,|\s*$)/g),
  ];
  let best: { url: string; width: number } | null = null;
  for (const m of matches) {
    const url = m[1];
    const w = parseInt(m[2], 10);
    if (
      !best ||
      Math.abs(w - preferredWidth) < Math.abs(best.width - preferredWidth)
    ) {
      best = { url, width: w };
    }
  }
  return best?.url ?? null;
}

async function dismissCookieBanner(page: Page) {
  try {
    await page
      .getByRole("button", { name: /I'm OK with that|Accept All|Reject All/ })
      .first()
      .click({ timeout: 3000 });
  } catch {
    // banner not present, fine
  }
}

async function fetchTeamSlugs(page: Page): Promise<{ name: string; slug: string }[]> {
  await page.goto(`${BASE}/teams`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await dismissCookieBanner(page);
  await page
    .waitForSelector(`a[href*="/teams/"]`, { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
  const links = await page.$$eval(`a[href*="/teams/"]`, (els) =>
    els
      .map((el) => {
        const a = el as HTMLAnchorElement;
        const href = a.getAttribute("href") ?? "";
        const m = href.match(/\/teams\/([a-z0-9-]+)(?:\/|$)/);
        if (!m) return null;
        const heading =
          a.querySelector("h3")?.textContent?.trim() ??
          a.textContent?.trim()?.split("\n")[0]?.trim() ??
          "";
        return { slug: m[1] ?? "", heading };
      })
      .filter((x) => x !== null && x.slug !== "")
  );
  const map = new Map<string, { name: string; slug: string }>();
  for (const t of links) {
    if (!t) continue;
    const display = t.heading || t.slug.replace(/-/g, " ");
    if (!map.has(t.slug)) map.set(t.slug, { name: display, slug: t.slug });
  }
  return [...map.values()];
}

async function readSquadImgs(page: Page): Promise<FifaPlayer[]> {
  // Scroll the player grid into view so lazy images bind their srcset.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const players = await page.$$eval("img", (imgs) =>
    imgs
      .filter(
        (i) =>
          i.alt &&
          i.alt.match(/[A-Z]{2,}/) &&
          // Player headshots are in player-badge-card_playerImage; exclude
          // banner/logo images.
          i.srcset &&
          i.srcset.includes("digitalhub.fifa.com") &&
          i.srcset.includes("aspectratio:1x1")
      )
      .map((i) => ({ alt: i.alt, srcset: i.srcset }))
  );

  const out: FifaPlayer[] = [];
  const seen = new Set<string>();
  for (const p of players) {
    const url = pickWidth(p.srcset, 320);
    if (!url) continue;
    const key = `${p.alt}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: p.alt, photoUrl: url });
  }
  return out;
}

async function fetchSquad(page: Page, slug: string): Promise<FifaPlayer[]> {
  const url = `${BASE}/teams/${slug}/squad`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page
    .waitForSelector(`img[srcset*="digitalhub.fifa.com"]`, { timeout: 20000 })
    .catch(() => {});

  let players = await readSquadImgs(page);
  if (players.length === 0) {
    // SPA didn't bind images yet — retry once with a longer wait.
    await page.waitForTimeout(3000);
    players = await readSquadImgs(page);
  }
  return players;
}

function matchPlayer(
  fifaName: string,
  candidates: { id: string; name: string }[]
): { id: string; name: string } | null {
  const want = normalizeName(fifaName);
  // exact normalized match
  for (const c of candidates) {
    if (normalizeName(c.name) === want) return c;
  }
  // last-name match — but always require first initial to agree when available,
  // so e.g. FIFA's "Lautaro MARTINEZ" doesn't get assigned to DB's "Emiliano Martínez".
  const wantParts = want.split(" ");
  if (wantParts.length === 0) return null;
  const wantLast = wantParts[wantParts.length - 1];
  const wantFirstInitial = wantParts.length > 1 ? wantParts[0][0] : null;

  const lastMatches = candidates.filter((c) => {
    const parts = normalizeName(c.name).split(" ");
    return parts[parts.length - 1] === wantLast;
  });
  if (lastMatches.length === 0) return null;

  if (wantFirstInitial) {
    const narrowed = lastMatches.filter((c) => {
      const parts = normalizeName(c.name).split(" ");
      return parts[0]?.[0] === wantFirstInitial;
    });
    if (narrowed.length === 1) return narrowed[0];
    // First initial disagrees with every candidate → refuse to match.
    return null;
  }

  // No first initial to disambiguate; only accept when last-name is unique.
  return lastMatches.length === 1 ? lastMatches[0] : null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  console.log(`Tournament: ${TOURNAMENT}`);
  console.log("Fetching team list from FIFA…");
  const teamSlugs = await fetchTeamSlugs(page);
  console.log(`  → ${teamSlugs.length} teams listed on FIFA`);

  if (teamSlugs.length === 0) {
    console.warn(
      "FIFA returned no teams for this tournament. Either the squad pages aren't live yet, or the URL pattern changed."
    );
    await browser.close();
    return;
  }

  const dbTeams = await prisma.team.findMany({
    include: { players: { select: { id: true, name: true } } },
  });
  // Match by both normalized name and slug-form ("United States" → "UNITED STATES").
  const dbTeamByNorm = new Map<string, (typeof dbTeams)[number]>();
  for (const t of dbTeams) {
    dbTeamByNorm.set(normalizeName(t.name), t);
    dbTeamByNorm.set(normalizeName(t.code), t);
  }
  function findDbTeam(
    fifaName: string,
    fifaSlug: string
  ): (typeof dbTeams)[number] | undefined {
    return (
      dbTeamByNorm.get(normalizeName(fifaSlug)) ??
      dbTeamByNorm.get(normalizeName(fifaName)) ??
      // Try just the first word of the heading (strip parens/codes).
      dbTeamByNorm.get(normalizeName(fifaName.split(/[(,]/)[0]))
    );
  }

  let matchedTeams = 0;
  let totalScraped = 0;
  let totalMatched = 0;
  let totalUpdated = 0;

  for (const { name: fifaTeamName, slug } of teamSlugs) {
    const dbTeam = findDbTeam(fifaTeamName, slug);
    if (!dbTeam) {
      console.log(`  · ${fifaTeamName} (${slug}): no matching team in DB, skipping`);
      continue;
    }
    matchedTeams++;
    process.stdout.write(`  · ${fifaTeamName} (${slug})… `);

    let scraped: FifaPlayer[] = [];
    try {
      scraped = await fetchSquad(page, slug);
    } catch (err) {
      console.log(`failed: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    totalScraped += scraped.length;

    let matched = 0;
    let updated = 0;
    for (const fp of scraped) {
      const dbPlayer = matchPlayer(fp.name, dbTeam.players);
      if (!dbPlayer) continue;
      matched++;
      const result = await prisma.player.update({
        where: { id: dbPlayer.id },
        data: { photo: fp.photoUrl, fifaName: fp.name },
        select: { id: true },
      });
      if (result) updated++;
    }
    totalMatched += matched;
    totalUpdated += updated;
    console.log(
      `${scraped.length} scraped, ${matched} matched (DB roster: ${dbTeam.players.length})`
    );
  }

  console.log(`\nSummary`);
  console.log(`  teams found on FIFA:    ${teamSlugs.length}`);
  console.log(`  teams matched in DB:    ${matchedTeams}`);
  console.log(`  players scraped:        ${totalScraped}`);
  console.log(`  players matched:        ${totalMatched}`);
  console.log(`  Player.photo updates:   ${totalUpdated}`);

  await browser.close();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
