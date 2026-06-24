import { collectBullseyes, type BullseyeMatch } from "@/lib/bullseye";
import { renderBullseyeCard } from "@/lib/bullseye-card-image";
import { prisma } from "@/lib/prisma";
import { withRetry } from "@/lib/retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadBullseyes(idsParam: string | null): Promise<BullseyeMatch[]> {
  const ids = (idsParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return [];

  const matches = await withRetry(() =>
    prisma.match.findMany({
      where: { id: { in: ids }, status: "FINISHED" },
      select: {
        id: true,
        stage: true,
        group: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { name: true, flag: true } },
        awayTeam: { select: { name: true, flag: true } },
        predictions: {
          select: {
            homeScore: true,
            awayScore: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    })
  );
  return collectBullseyes(matches);
}

export async function GET(req: Request) {
  const matches = await loadBullseyes(new URL(req.url).searchParams.get("m"));
  return renderBullseyeCard(matches);
}
