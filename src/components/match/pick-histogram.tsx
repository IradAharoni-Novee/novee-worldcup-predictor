import type { ScoreBucket } from "@/lib/pick-aggregates";

type Props = {
  buckets: ScoreBucket[];
  total: number;
  /** The current viewer's prediction, if any. Highlighted in brand purple. */
  yourPick: { homeScore: number; awayScore: number } | null;
  /** The actual final score. Outlined in green when present. */
  actual: { homeScore: number; awayScore: number } | null;
};

/**
 * Horizontal bar chart of the most-picked scores for a single match. Pure CSS
 * (no chart library). Top six buckets are shown; everything else is rolled
 * into an "other" row.
 */
export function PickHistogram({ buckets, total, yourPick, actual }: Props) {
  if (total === 0 || buckets.length === 0) return null;

  const TOP_N = 6;
  const top = buckets.slice(0, TOP_N);
  const rest = buckets.slice(TOP_N);
  const otherCount = rest.reduce((sum, b) => sum + b.count, 0);
  const otherPercent = total > 0 ? (otherCount / total) * 100 : 0;
  const max = Math.max(...top.map((b) => b.percent), otherPercent);

  return (
    <div className="flex flex-col gap-1.5">
      {top.map((b) => {
        const isYours =
          yourPick !== null &&
          b.homeScore === yourPick.homeScore &&
          b.awayScore === yourPick.awayScore;
        const isActual =
          actual !== null &&
          b.homeScore === actual.homeScore &&
          b.awayScore === actual.awayScore;
        const width = max === 0 ? 0 : (b.percent / max) * 100;
        return (
          <HistogramRow
            key={b.score}
            label={b.score}
            count={b.count}
            percent={b.percent}
            width={width}
            isYours={isYours}
            isActual={isActual}
          />
        );
      })}
      {otherCount > 0 && (
        <HistogramRow
          label="Other"
          count={otherCount}
          percent={otherPercent}
          width={max === 0 ? 0 : (otherPercent / max) * 100}
          isYours={false}
          isActual={false}
        />
      )}
    </div>
  );
}

function HistogramRow({
  label,
  count,
  percent,
  width,
  isYours,
  isActual,
}: {
  label: string;
  count: number;
  percent: number;
  width: number;
  isYours: boolean;
  isActual: boolean;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_4rem] items-center gap-3">
      <span className="code code-size-small tabular-nums text-right">
        {label}
      </span>
      <div className="relative h-5 rounded-md bg-[color:var(--color-surface-secondary)] overflow-hidden">
        <div
          className={
            "absolute inset-y-0 left-0 rounded-md transition-all " +
            (isYours
              ? "bg-[color:var(--color-action-primary-cta)]"
              : "bg-[color:var(--color-border-primary)]")
          }
          style={{ width: `${width}%` }}
        />
        {isActual && (
          <div className="absolute inset-0 rounded-md ring-2 ring-[color:var(--color-accent-success)] pointer-events-none" />
        )}
      </div>
      <span className="body body-size-small tabular-nums text-[color:var(--color-text-tertiary)]">
        {percent.toFixed(0)}% · {count}
      </span>
    </div>
  );
}
