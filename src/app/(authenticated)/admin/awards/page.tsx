import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/shell/page-container";
import { AwardsActualsForm } from "@/components/admin/awards-actuals-form";
import {
  SETTING_KEY_ACTUAL_GOLDEN_BOOT,
  SETTING_KEY_ACTUAL_WINNER,
} from "@/lib/scoring-awards";

export default async function AdminAwardsPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect("/awards");

  const [teams, players, winnerSetting, gbSetting] = await Promise.all([
    prisma.team.findMany({ orderBy: { name: "asc" } }),
    prisma.player.findMany({
      include: { team: { select: { name: true } } },
      orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_WINNER } }),
    prisma.setting.findUnique({ where: { key: SETTING_KEY_ACTUAL_GOLDEN_BOOT } }),
  ]);

  return (
    <PageContainer title="Admin · Awards">
      <p className="body body-size-medium text-[color:var(--color-text-secondary)] mb-3">
        Once the real winner and golden boot are decided, set them here. Points
        are awarded to anyone who picked correctly.
      </p>
      <Card className="px-4 py-4">
        <AwardsActualsForm
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          players={players.map((p) => ({
            id: p.id,
            name: p.name,
            teamName: p.team?.name ?? null,
          }))}
          initialWinnerTeamId={
            typeof winnerSetting?.value === "string" ? winnerSetting.value : null
          }
          initialGoldenBootPlayerId={
            typeof gbSetting?.value === "string" ? gbSetting.value : null
          }
        />
      </Card>
    </PageContainer>
  );
}
