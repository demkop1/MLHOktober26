import { useState } from "react";
import { ChevronDown, AlertTriangle, FileText, MessageCircle, Sparkles, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classify, rangePosition, STATUS_LABEL } from "@/lib/lab/engine";
import { explain } from "@/lib/lab/explanations";
import type { Trend } from "@/lib/lab/trends";
import type { LabResult, Status } from "@/lib/lab/types";
import { resultNarration } from "@/lib/speech/narration";
import { cn } from "@/lib/utils";
import { TrendChart } from "./TrendChart";
import { SpeakButton } from "./voice/VoicePlayer";

export const STATUS_STYLE: Record<Status, string> = {
  below: "bg-status-low-soft text-status-low",
  within: "bg-status-in-soft text-status-in",
  above: "bg-status-high-soft text-status-high",
  unknown: "bg-status-unknown-soft text-status-unknown",
};
const DOT: Record<Status, string> = {
  below: "bg-status-low",
  within: "bg-status-in",
  above: "bg-status-high",
  unknown: "bg-status-unknown",
};

interface Props {
  r: LabResult;
  index?: number;
  trend?: Trend | undefined;
  onExplain?: ((r: LabResult) => void) | undefined;
  onFollowUp?: ((r: LabResult) => void) | undefined;
}

export function ResultCard({ r, index = 0, trend, onExplain, onFollowUp }: Props) {
  const [open, setOpen] = useState(false);
  const c = classify(r);
  const pos = rangePosition(r);
  const ex = explain(r.name);
  const rangeText = r.rangeRaw ? `${r.rangeRaw} ${r.rangeUnit || r.unit}`.trim() : "not shown on report";

  return (
    <article
      className={cn(
        "fade-up flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-ring/40",
        r.critical ? "border-destructive/60" : "border-border",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      aria-labelledby={`t-${r.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={`t-${r.id}`} className="font-sans text-base font-semibold leading-tight">{r.name}</h3>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[c.status])}>{STATUS_LABEL[c.status]}</span>
      </div>

      {r.critical && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
          <Siren className="h-3.5 w-3.5" /> Marked critical by the lab — follow your lab's or clinician's instructions.
        </p>
      )}

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold">{r.valueRaw || "—"}</span>
        <span className="text-sm text-muted-foreground">{r.unit}</span>
        {r.flag && <span className="ml-auto text-xs text-muted-foreground">Lab flag: {r.flag}</span>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Lab reference range: {rangeText}</p>

      {pos && (
        <div className="mt-4">
          <p className="sr-only">{`${r.valueRaw} ${r.unit}, ${STATUS_LABEL[c.status].toLowerCase()}, lab range ${rangeText}.`}</p>
          <div className="relative h-2 rounded-full bg-muted" aria-hidden>
            <div className="range-grow absolute inset-y-0 rounded-full bg-status-in/35" style={{ left: `${pos.lo * 100}%`, width: `${(pos.hi - pos.lo) * 100}%` }} />
            <div className={cn("marker-in absolute top-1/2 h-4 w-4 rounded-full border-2 border-card shadow", DOT[c.status])} style={{ left: `${pos.v * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground" aria-hidden>
            <span>lower</span><span>printed range</span><span>higher</span>
          </div>
        </div>
      )}

      {c.uncertainties.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl bg-status-high-soft/60 p-3 text-xs text-foreground">
          {c.uncertainties.map((u) => <li key={u} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-high" />{u}</li>)}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1">
        {onExplain && <Button size="sm" variant="secondary" className="rounded-full" onClick={() => onExplain(r)}><Sparkles className="h-3.5 w-3.5" /> Explain this result</Button>}
        {onFollowUp && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onFollowUp(r)}><MessageCircle className="h-3.5 w-3.5" /> Ask a follow-up</Button>}
        <SpeakButton text={resultNarration(r)} label={r.name} className="ml-auto rounded-full" />
      </div>

      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 flex items-center justify-between rounded-xl px-1 text-sm font-medium text-primary hover:underline">
        What it measures & trend
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="fade-up mt-2 space-y-3 text-sm text-muted-foreground">
          <p>{ex ? ex.what : "We don't have a plain-language description for this test yet. Ask your clinician what it measures."}</p>
          <p>{c.basis} Being inside or outside a range is not a diagnosis — your clinician interprets results in context.</p>
          {trend && <TrendChart trend={trend} low={r.rangeLow} high={r.rangeHigh} unit={r.unit} />}
          <p className="flex items-center gap-1 text-xs"><FileText className="h-3.5 w-3.5" />{r.page ? `Source: page ${r.page}` : "Added manually"}{r.sourceLine && ` · “${r.sourceLine}”`}</p>
        </div>
      )}
    </article>
  );
}
