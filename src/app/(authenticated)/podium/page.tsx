import { redirect } from "next/navigation";
import { Medal } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PodiumPickerForm } from "@/components/predictor/podium-form";
import { SubmissionDeadline } from "@/components/predictor/submission-deadline";
import { getBracketLockTime, isBracketLocked } from "@/lib/locks";
import {
  deriveActualPodium,
  getLeaderboard,
  getScoringConfig,
  isPodiumSettled,
} from "@/lib/leaderboard";
import { getPodiumConsensus } from "@/lib/pick-aggregates";
import { isAiPlayer } from "@/lib/ai-players";

const SLOT_LABELS = ["1st", "2nd", "3rd"] as const;

type Person = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

function displayName(p: Person): string {
  return p.name ?? p.email.split("@")[0] ?? p.email;
}

export default async function PodiumPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const [config, allUsers, myPick, lockTime, locked, settled] =
    await Promise.all([
      getScoringConfig(),
      prisma.user.findMany({
        orderBy: [{ name: "asc" }, { email: "asc" }],
        select: { id: true, name: true, email: true, image: true },
      }),
      prisma.podiumPrediction.findUnique({ where: { userId } }),
      getBracketLockTime(),
      isBracketLocked(),
      isPodiumSettled(),
    ]);

  const people = allUsers.filter((u) => !isAiPlayer(u.email));
  const byId = new Map(people.map((p) => [p.id, p]));

  const consensus = locked ? await getPodiumConsensus() : null;

  let actualPodium: Person[] = [];
  let myPoints = 0;
  if (settled) {
    const rows = await getLeaderboard();
    actualPodium = deriveActualPodium(rows)
      .map((id) => byId.get(id))
      .filter((p): p is Person => p !== undefined);
    myPoints = rows.find((r) => r.userId === userId)?.podiumPoints ?? 0;
  }

  const showFinalPodium = settled && actualPodium.length === 3;
  const hasSideColumn =
    showFinalPodium || (consensus !== null && consensus.total > 0);

  return (
    <PageContainer title="Podium">
      <div className={hasSideColumn ? undefined : "mx-auto w-full max-w-xl"}>
        <Card className="px-4 sm:px-6 py-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="body body-size-small text-[color:var(--color-text-secondary)]">
                {locked
                  ? "Picks are locked — the knockouts have started"
                  : lockTime
                    ? "Picks lock when the knockouts start"
                    : "No knockout fixtures scheduled yet"}
              </p>
              <p className="heading text-lg">
                Call the final leaderboard top 3
              </p>
            </div>
            {settled && (
              <div className="text-right">
                <p className="body body-size-small text-[color:var(--color-text-secondary)]">
                  Podium points
                </p>
                <p className="heading text-2xl">{myPoints}</p>
              </div>
            )}
          </div>
        </Card>

        <div className={hasSideColumn ? "grid gap-4 md:grid-cols-2" : undefined}>
          <Card className="px-4 py-4 gap-3">
            <div className="flex items-center justify-between">
              <span className="heading text-base flex items-center gap-2">
                <Medal className="size-4" /> Your podium
              </span>
              <Chip
                size="small"
                color="brand"
                label={`${config.podiumExactPosition} pts exact · ${config.podiumInTop3} if on the podium`}
              />
            </div>
            <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
              Who finishes 1st, 2nd and 3rd overall? AI players don&apos;t count —
              you can pick yourself.
            </p>
            {people.length === 0 ? (
              <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
                No players to pick from yet.
              </p>
            ) : (
              <PodiumPickerForm
                people={people}
                initial={
                  myPick
                    ? {
                        firstId: myPick.firstId,
                        secondId: myPick.secondId,
                        thirdId: myPick.thirdId,
                      }
                    : null
                }
                locked={locked}
              />
            )}
            {!locked && lockTime && (
              <div className="border-t border-[color:var(--color-border-secondary)] pt-2">
                <SubmissionDeadline deadline={lockTime} label="Locks at" />
              </div>
            )}
          </Card>

          {hasSideColumn && (
            <div className="flex flex-col gap-4">
              {showFinalPodium && (
                <Card className="px-4 py-4 gap-3">
                  <span className="heading text-base">Final podium</span>
                  <div className="flex flex-col gap-2">
                    {actualPodium.map((person, i) => {
                      const predictedHere = myPick
                        ? [myPick.firstId, myPick.secondId, myPick.thirdId][
                            i
                          ] === person.id
                        : false;
                      return (
                        <div
                          key={person.id}
                          className="flex items-center gap-3 rounded-md border border-[color:var(--color-border-secondary)] px-3 py-2"
                        >
                          <span className="code code-size-medium w-8 shrink-0 text-[color:var(--color-text-tertiary)]">
                            {SLOT_LABELS[i]}
                          </span>
                          <UserAvatar
                            email={person.email}
                            name={person.name}
                            image={person.image}
                            size={28}
                          />
                          <span className="body body-weight-medium body-size-small truncate flex-1">
                            {displayName(person)}
                          </span>
                          {predictedHere && (
                            <Chip
                              size="small"
                              color="green"
                              label="You nailed it"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {consensus && consensus.total > 0 && (
                <Card className="px-4 py-4 gap-3">
                  <div>
                    <span className="heading text-base">
                      What the room thinks
                    </span>
                    <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
                      Leading pick per slot · {consensus.total} submitted
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {SLOT_LABELS.map((label, i) => {
                      const top = consensus.slots[i]?.[0];
                      const person = top ? byId.get(top.userId) : undefined;
                      return (
                        <div key={label} className="flex items-center gap-3">
                          <span className="code code-size-medium w-8 shrink-0 text-[color:var(--color-text-tertiary)]">
                            {label}
                          </span>
                          {person && top ? (
                            <>
                              <UserAvatar
                                email={person.email}
                                name={person.name}
                                image={person.image}
                                size={24}
                              />
                              <span className="body body-size-small truncate flex-1">
                                {displayName(person)}
                              </span>
                              <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                                {top.count} vote{top.count === 1 ? "" : "s"}
                              </span>
                            </>
                          ) : (
                            <span className="body body-size-small text-[color:var(--color-text-tertiary)]">
                              No votes
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
