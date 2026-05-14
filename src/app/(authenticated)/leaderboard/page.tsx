import { Trophy } from "lucide-react";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeaderboard } from "@/lib/leaderboard";

export default async function LeaderboardPage() {
  const session = await auth();
  const rows = await getLeaderboard();

  if (rows.length === 0) {
    return (
      <PageContainer title="Leaderboard">
        <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-12 text-center body body-size-medium text-[color:var(--color-text-secondary)]">
          No predictions scored yet. Come back after the first match wraps up.
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Leaderboard">
      <Card className="p-0 py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Exact</TableHead>
              <TableHead className="text-right">Outcome</TableHead>
              <TableHead className="text-right">Predictions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => {
              const rank = index + 1;
              const me = row.userId === session?.user?.id;
              return (
                <TableRow
                  key={row.userId}
                  className={
                    me
                      ? "bg-[color:var(--color-category-bg-brand)]/40"
                      : undefined
                  }
                >
                  <TableCell>
                    {rank <= 3 ? (
                      <Chip
                        size="small"
                        color={
                          rank === 1 ? "amber" : rank === 2 ? "slate" : "orange"
                        }
                        label={
                          <span className="flex items-center gap-1">
                            <Trophy className="size-3" />
                            {rank}
                          </span>
                        }
                      />
                    ) : (
                      <span className="body body-size-medium tabular-nums">
                        {rank}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="body body-weight-medium body-size-medium">
                        {row.name ?? row.email.split("@")[0]}
                        {me && (
                          <span className="ml-2 text-xs text-[color:var(--color-action-primary-cta)]">
                            You
                          </span>
                        )}
                      </span>
                      <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                        {row.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right code code-size-large tabular-nums">
                    {row.total}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.exact}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.outcome}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.predictions}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </PageContainer>
  );
}
