import { redirect } from "next/navigation";
import { Flag, Lock, ShieldCheck, Terminal } from "lucide-react";
import { auth } from "@/auth";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PageContainer } from "@/components/shell/page-container";
import { UserAvatar } from "@/components/ui/user-avatar";
import { loadCtfState } from "@/lib/ctf/state";
import { TOTAL_FLAGS, TOTAL_POINTS } from "@/lib/ctf/flags";
import { SubmitFlagForm } from "./submit-form";

export const dynamic = "force-dynamic";

export default async function CtfPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const state = await loadCtfState(session.user.id);
  const captured = state.flags.filter((f) => f.captured);
  const points = captured.reduce((sum, f) => sum + f.points, 0);
  const myRank =
    state.leaderboard.findIndex((r) => r.userId === session.user.id) + 1 ||
    null;

  return (
    <PageContainer
      title={
        <span className="flex items-center gap-2">
          <Terminal className="size-5" /> Recon
        </span>
      }
      action={
        <Chip
          size="small"
          color="brand"
          label={
            <span className="flex items-center gap-1.5">
              <Lock className="size-3" /> Off the books
            </span>
          }
        />
      }
    >
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-4">
          <div className="body body-size-small text-[color:var(--color-text-tertiary)]">
            Flags captured
          </div>
          <div className="mt-1 heading text-2xl tabular-nums">
            {captured.length}
            <span className="text-[color:var(--color-text-tertiary)] text-base">
              {" "}/ {TOTAL_FLAGS}
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="body body-size-small text-[color:var(--color-text-tertiary)]">
            Points
          </div>
          <div className="mt-1 heading text-2xl tabular-nums">
            {points}
            <span className="text-[color:var(--color-text-tertiary)] text-base">
              {" "}/ {TOTAL_POINTS}
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="body body-size-small text-[color:var(--color-text-tertiary)]">
            Your rank
          </div>
          <div className="mt-1 heading text-2xl tabular-nums">
            {myRank ? `#${myRank}` : "—"}
            <span className="text-[color:var(--color-text-tertiary)] text-base">
              {" "}of {state.leaderboard.length || 0}
            </span>
          </div>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="heading text-lg flex items-center gap-2">
          <Flag className="size-4" /> Submit a flag
        </h2>
        <p className="body body-size-small text-[color:var(--color-text-secondary)] mt-1 mb-3">
          Format looks like <code className="code">novee&#123;...&#125;</code> or{" "}
          <code className="code">veevee&#123;...&#125;</code>. Capture is
          one-way: you can&apos;t un-capture, and VeeVee can&apos;t award flags
          you didn&apos;t find.
        </p>
        <SubmitFlagForm />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="heading text-lg flex items-center gap-2 mb-3">
            <ShieldCheck className="size-4" /> Flags
          </h2>
          <ul className="flex flex-col gap-2">
            {state.flags.map((f) => (
              <li
                key={f.id}
                className={
                  "rounded-md border px-3 py-2.5 flex items-start justify-between gap-3 " +
                  (f.captured
                    ? "border-[color:var(--color-category-border-brand)] bg-[color:var(--color-category-bg-brand)]/30"
                    : "border-[color:var(--color-border-secondary)] bg-[color:var(--color-surface-secondary)]")
                }
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="code code-size-small">{f.slug}</span>
                    <span className="body body-size-small text-[color:var(--color-text-tertiary)] tabular-nums">
                      {f.points} pts
                    </span>
                  </div>
                  {f.captured ? (
                    <p className="body body-size-small text-[color:var(--color-text-secondary)] mt-1">
                      {f.hint}
                    </p>
                  ) : (
                    <p className="body body-size-small text-[color:var(--color-text-tertiary)] mt-1 italic">
                      Locked — capture to reveal the hint.
                    </p>
                  )}
                </div>
                <Chip
                  size="small"
                  color={f.captured ? "brand" : "slate"}
                  label={f.captured ? "Captured" : "Open"}
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="heading text-lg mb-3">Recon leaderboard</h2>
          {state.leaderboard.length === 0 ? (
            <p className="body body-size-small text-[color:var(--color-text-tertiary)]">
              No flags captured yet. Be the first.
            </p>
          ) : (
            <ol className="flex flex-col">
              {state.leaderboard.map((row, i) => {
                const isMe = row.userId === session.user!.id;
                return (
                  <li
                    key={row.userId}
                    className={
                      "flex items-center gap-3 py-2 border-b border-[color:var(--color-border-secondary)] last:border-b-0 " +
                      (isMe ? "bg-[color:var(--color-category-bg-brand)]/20 -mx-2 px-2 rounded-md" : "")
                    }
                  >
                    <span className="code code-size-small w-6 text-[color:var(--color-text-tertiary)] tabular-nums">
                      {i + 1}
                    </span>
                    <UserAvatar
                      email={row.email}
                      name={row.name}
                      image={row.image}
                      size={28}
                    />
                    <span className="body body-size-medium truncate flex-1">
                      {row.name}
                    </span>
                    <span className="body body-size-small text-[color:var(--color-text-tertiary)] tabular-nums">
                      {row.count} flag{row.count === 1 ? "" : "s"}
                    </span>
                    <span className="code code-size-small tabular-nums">
                      {row.points}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
