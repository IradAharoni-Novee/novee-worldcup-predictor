import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/shell/page-container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MatchResultForm } from "@/components/admin/match-result-form";
import { stageLabel } from "@/lib/format";
import { LocalKickoff } from "@/components/predictor/submission-deadline";

export default async function AdminMatchesPage() {
  const matches = await prisma.match.findMany({
    orderBy: { kickoff: "asc" },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  return (
    <PageContainer title="Admin · Matches">
      <Card className="p-0 py-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead>Kickoff</TableHead>
              <TableHead>Home</TableHead>
              <TableHead>Away</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="body body-size-small">
                  {stageLabel(m.stage, m.group)}
                </TableCell>
                <TableCell className="body body-size-small text-[color:var(--color-text-secondary)]">
                  <LocalKickoff date={m.kickoff} />
                </TableCell>
                <TableCell>{m.homeTeam?.name ?? "TBD"}</TableCell>
                <TableCell>{m.awayTeam?.name ?? "TBD"}</TableCell>
                <TableCell>
                  <MatchResultForm
                    match={{
                      id: m.id,
                      homeScore: m.homeScore,
                      awayScore: m.awayScore,
                      status: m.status,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </PageContainer>
  );
}
