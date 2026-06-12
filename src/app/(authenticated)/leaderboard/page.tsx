import { Trophy } from "lucide-react";
import Link from "next/link";
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
import { UserAvatar } from "@/components/ui/user-avatar";
import { getLeaderboard } from "@/lib/leaderboard";
import { veeveeLine } from "@/lib/veevee-voice";
import { Odometer } from "@/components/ui/odometer";

export default async function LeaderboardPage() {
  const session = await auth();
  const rows = await getLeaderboard();

  if (rows.length === 0) {
    return (
      <PageContainer title="Leaderboard">
        <div className="rounded-xl border border-dashed border-[color:var(--color-border-primary)] p-12 text-center body body-size-medium text-[color:var(--color-text-secondary)]">
          <p className="italic text-[color:var(--color-text-tertiary)] mb-2">
            {veeveeLine("emptyLeaderboard", session?.user?.id)}
          </p>
          <p>Come back after the first match wraps up.</p>
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
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Matches</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Groups</TableHead>
              <TableHead className="text-right hidden md:table-cell">Bracket</TableHead>
              <TableHead className="text-right hidden md:table-cell">Awards</TableHead>
              <TableHead className="text-right hidden lg:table-cell">Exact</TableHead>
              <TableHead className="text-right hidden lg:table-cell">Predictions</TableHead>
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
                    <Link
                      href={me ? "/me" : `/u/${row.userId}`}
                      className="flex items-center gap-3 min-w-0 hover:underline"
                    >
                      <LeaderboardAvatar
                        email={row.email}
                        name={row.name}
                        image={row.image}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="body body-weight-medium body-size-medium truncate">
                          {row.name ?? row.email.split("@")[0]}
                          {me && (
                            <span className="ml-2 text-xs text-[color:var(--color-action-primary-cta)]">
                              You
                            </span>
                          )}
                        </span>
                        <span className="hidden sm:inline body body-size-small text-[color:var(--color-text-tertiary)] truncate">
                          {row.email}
                        </span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right code code-size-large tabular-nums">
                    <Odometer
                      value={row.total}
                      storageKey={`lb:total:${row.userId}`}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">
                    {row.matchPoints}
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden sm:table-cell">
                    {row.groupPoints}
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden md:table-cell">
                    {row.bracketPoints}
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden md:table-cell">
                    {row.awardsPoints}
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden lg:table-cell">
                    {row.exact}
                  </TableCell>
                  <TableCell className="text-right tabular-nums hidden lg:table-cell">
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

function LeaderboardAvatar({
  email,
  name,
  image,
}: {
  email: string;
  name: string | null;
  image: string | null;
}) {
  return <UserAvatar email={email} name={name} image={image} size={32} />;
}
