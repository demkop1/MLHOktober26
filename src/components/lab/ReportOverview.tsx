import { AlertTriangle, Siren } from "lucide-react";
import { classify } from "@/lib/lab/engine";
import type { LabReport, Status } from "@/lib/lab/types";
import { overviewCounts, overviewNarration } from "@/lib/speech/narration";
import { cn } from "@/lib/utils";
import { STATUS_STYLE } from "./ResultCard";
import { SpeakButton } from "./voice/VoicePlayer";

const TILES: { s: Status; label: string }[] = [
  { s: "below", label: "Below range" },
  { s: "within", label: "Within range" },
  { s: "above", label: "Above range" },
  { s: "unknown", label: "Couldn't compare" },
];

export function ReportOverview({ report, onJump }: { report: LabReport; onJump: (id: string) => void }) {
  const c = overviewCounts(report);
  const critical = report.results.filter((r) => r.critical);
  const check = report.results.filter((r) => r.needsReview || classify(r).status === "unknown");

  return (
    <section aria-labelledby="overview-h" className="fade-up rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="overview-h" className="text-2xl font-semibold">Your report at a glance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.total} results, compared only with the ranges printed by your lab. This isn't a health score — talk to your clinician about what it means for you.
          </p>
        </div>
        <SpeakButton text={overviewNarration(report)} label="Report overview" className="rounded-full border border-border">Listen</SpeakButton>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.s} className={cn("rounded-2xl p-4", STATUS_STYLE[t.s])}>
            <p className="font-display text-3xl font-semibold">{c[t.s]}</p>
            <p className="text-xs font-medium">{t.label}</p>
          </div>
        ))}
      </div>

      {critical.length > 0 && (
        <div role="alert" className="mt-4 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-destructive"><Siren className="h-4 w-4" /> Your lab marked {critical.length} result{critical.length > 1 ? "s" : ""} as critical</p>
          <p className="mt-1 text-foreground">This label comes from the lab, not from this app. Follow the instructions from your lab or clinician; if you feel unwell, seek medical help.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {critical.map((r) => <button key={r.id} onClick={() => onJump(r.id)} className="rounded-full bg-card px-2.5 py-1 text-xs font-medium hover:underline">{r.name}: {r.valueRaw} {r.unit}</button>)}
          </div>
        </div>
      )}

      {check.length > 0 && (
        <div className="mt-4 rounded-2xl bg-status-high-soft/60 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-status-high" /> {check.length} result{check.length > 1 ? "s" : ""} need checking</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {check.map((r) => (
              <button key={r.id} onClick={() => onJump(r.id)} className="rounded-full bg-card px-2.5 py-1 text-xs hover:underline">
                {r.name} · {r.needsReview ? "not confirmed" : "no comparable range"}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
