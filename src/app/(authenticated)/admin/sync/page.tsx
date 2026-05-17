import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/shell/page-container";
import { SyncButton } from "@/components/admin/sync-button";

export default function AdminSyncPage() {
  return (
    <PageContainer title="Admin · Sync">
      <Card>
        <CardHeader>
          <CardTitle>Sync from football-data.org, ESPN &amp; FIFA</CardTitle>
          <CardDescription>
            Fixtures &amp; results pull from football-data.org (daily cron at 06:00 UTC).
            Match venues (stadium, city, country) pull from ESPN's public scoreboard
            in the same job. Squads pull biographical data from football-data.org.
            Player photos are scraped
            from FIFA&apos;s tournament squad pages — that one runs from the CLI because
            it spins up a headless browser:
            <br />
            <code className="code code-size-small">pnpm tsx prisma/sync-squad-photos.ts</code>
            <br />
            For testing against past tournaments:{" "}
            <code className="code code-size-small">
              pnpm tsx prisma/sync-squad-photos.ts qatar2022
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncButton />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
