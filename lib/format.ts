// ─── Shared formatting helpers ───────────────────────────────────────────────

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-NG");
}

export function fmtCurrency(n: number | null | undefined): string {
  return `₦${(n ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
