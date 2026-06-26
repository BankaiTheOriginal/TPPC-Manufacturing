// ─── Shared Progress Bar component ───────────────────────────────────────────

export function ProgressBar({
  value,
  total,
}: {
  value: number | null;
  total: number;
}) {
  const pct =
    value !== null && total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-teal-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500 tabular-nums whitespace-nowrap">
        {value ?? 0}/{total}
      </span>
    </div>
  );
}
