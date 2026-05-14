import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/shell/page-container";
import { SyncButton } from "@/components/admin/sync-button";

export default function AdminSyncPage() {
  return (
    <PageContainer title="Admin · Sync">
      <Card>
        <CardHeader>
          <CardTitle>Pull fixtures &amp; results</CardTitle>
          <CardDescription>
            Fetches the current state of the World Cup 2026 from football-data.org and
            upserts teams + matches into the database. Existing predictions are not
            touched. A daily cron runs this automatically at 06:00 UTC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyncButton />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
