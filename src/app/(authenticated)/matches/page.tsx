import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/shell/page-container";
import { MatchCard } from "@/components/match/match-card";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { scorePrediction } from "@/lib/scoring";

type Filter = "upcoming" | "live" | "finished";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: Filter }>;
}) {
  const { filter = "upcoming" } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  const matches = await prisma.match.findMany({
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: { select: { name: true, code: true, flag: true } },
      awayTeam: { select: { name: true, code: true, flag: true } },
      predictions: userId
        ? {
            where: { userId },
            select: { homeScore: true, awayScore: true },
          }
        : false,
    },
  });

  const now = new Date();
  const buckets: Record<Filter, typeof matches> = {
    upcoming: matches.filter(
      (m) => m.status === "SCHEDULED" && m.kickoff > now
    ),
    live: matches.filter((m) => m.status === "LIVE"),
    finished: matches.filter((m) => m.status === "FINISHED"),
  };

  function render(list: typeof matches) {
    if (list.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-12 text-center body body-size-medium text-[color:var(--color-text-secondary)]">
          Nothing here yet.
        </div>
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((m) => {
          const prediction = m.predictions?.[0] ?? null;
          const points =
            m.status === "FINISHED"
              ? scorePrediction(prediction, {
                  stage: m.stage,
                  homeScore: m.homeScore,
                  awayScore: m.awayScore,
                })
              : null;
          return (
            <MatchCard
              key={m.id}
              id={m.id}
              stage={m.stage}
              group={m.group}
              kickoff={m.kickoff}
              homeTeam={m.homeTeam}
              awayTeam={m.awayTeam}
              homeScore={m.homeScore}
              awayScore={m.awayScore}
              status={m.status}
              prediction={prediction}
              points={points}
            />
          );
        })}
      </div>
    );
  }

  return (
    <PageContainer title="Matches">
      <Tabs defaultValue={filter}>
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({buckets.upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="live">Live ({buckets.live.length})</TabsTrigger>
          <TabsTrigger value="finished">
            Finished ({buckets.finished.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">{render(buckets.upcoming)}</TabsContent>
        <TabsContent value="live">{render(buckets.live)}</TabsContent>
        <TabsContent value="finished">{render(buckets.finished)}</TabsContent>
      </Tabs>
    </PageContainer>
  );
}
