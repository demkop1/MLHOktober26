import type { Trend } from "@/lib/lab/trends";

/** Small accessible SVG trend. Shows the current lab range band when it's numeric on both ends. */
export function TrendChart({ trend, low, high, unit }: { trend: Trend; low: number | null; high: number | null; unit: string }) {
  if (trend.reason) return <p className="text-xs text-muted-foreground">{trend.reason}</p>;
  const pts = trend.points;
  const vals = pts.map((p) => p.value).concat(low ?? [], high ?? []);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min || 1) * 0.15;
  const lo = min - pad, hi = max + pad;
  const W = 240, H = 64;
  const x = (i: number) => 8 + (i / (pts.length - 1)) * (W - 16);
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 12);
  const desc = pts.map((p) => `${p.date}: ${p.valueRaw} ${unit}`).join("; ");

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label={`Trend: ${desc}`}>
        {low !== null && high !== null && (
          <rect x={0} width={W} y={y(high)} height={Math.max(1, y(low) - y(high))} className="fill-status-in/15" />
        )}
        <polyline fill="none" strokeWidth={2} className="stroke-primary" points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
        {pts.map((p, i) => (
          <circle key={p.reportId} cx={x(i)} cy={y(p.value)} r={i === pts.length - 1 ? 4 : 3} className={i === pts.length - 1 ? "fill-primary" : "fill-card stroke-primary"} strokeWidth={2} />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        {pts.map((p) => <span key={p.reportId}>{p.date}: <strong className="text-foreground">{p.valueRaw}</strong></span>)}
      </figcaption>
    </figure>
  );
}
