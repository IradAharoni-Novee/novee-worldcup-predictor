import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/shell/page-container";
import { Chip } from "@/components/ui/chip";
import { formatKickoff } from "@/lib/format";
import type { Stage } from "@prisma/client";

const STAGES: { stage: Stage; label: string }[] = [
  { stage: "R32", label: "Round of 32" },
  { stage: "R16", label: "Round of 16" },
  { stage: "QF", label: "Quarter-finals" },
  { stage: "SF", label: "Semi-finals" },
  { stage: "THIRD", label: "Third place" },
  { stage: "FINAL", label: "Final" },
];

export default async function BracketPage() {
  const matches = await prisma.match.findMany({
    where: { stage: { in: STAGES.map((s) => s.stage) } },
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  const byStage = new Map<Stage, typeof matches>();
  for (const m of matches) {
    const list = byStage.get(m.stage) ?? [];
    list.push(m);
    byStage.set(m.stage, list);
  }

  return (
    <PageContainer title="Bracket">
      <div className="flex gap-6 overflow-x-auto pb-4">
        {STAGES.map(({ stage, label }) => {
          const list = byStage.get(stage) ?? [];
          return (
            <div key={stage} className="flex flex-col gap-3 min-w-[220px]">
              <h2 className="subheading subheading-size-medium subheading-weight-medium text-[color:var(--color-text-secondary)]">
                {label}
              </h2>
              {list.length === 0 ? (
                <Card className="py-3 px-4 body body-size-small text-[color:var(--color-text-tertiary)]">
                  Not seeded yet.
                </Card>
              ) : (
                list.map((m) => (
                  <Link
                    key={m.id}
                    href={`/matches/${m.id}`}
                    className="block"
                  >
                    <Card className="py-3 gap-1 hover:border-[color:var(--color-border-hover)] transition-colors">
                      <div className="px-4 flex items-center justify-between">
                        <span className="body body-weight-medium body-size-medium truncate">
                          {m.homeTeam?.name ?? "TBD"}
                        </span>
                        <span className="code code-size-medium tabular-nums">
                          {m.homeScore ?? ""}
                        </span>
                      </div>
                      <div className="px-4 flex items-center justify-between">
                        <span className="body body-weight-medium body-size-medium truncate">
                          {m.awayTeam?.name ?? "TBD"}
                        </span>
                        <span className="code code-size-medium tabular-nums">
                          {m.awayScore ?? ""}
                        </span>
                      </div>
                      <div className="px-4 pt-1 border-t border-[color:var(--color-border-secondary)] flex items-center justify-between">
                        <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                          {formatKickoff(m.kickoff)}
                        </span>
                        {m.status === "LIVE" && (
                          <Chip size="small" color="red" label="LIVE" />
                        )}
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
