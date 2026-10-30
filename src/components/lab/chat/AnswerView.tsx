import { useState } from "react";
import { BookOpen, ChevronDown, Cpu, FileText, HelpCircle, Library } from "lucide-react";
import type { Answer } from "@/lib/ai/answer";
import { cn } from "@/lib/utils";

function Section({ title, icon: Icon, children, tone = "default" }: { title: string; icon: typeof FileText; children: React.ReactNode; tone?: "report" | "default" }) {
  return (
    <section className={cn("rounded-xl p-3", tone === "report" ? "border border-primary/25 bg-secondary/60" : "bg-muted/60")}>
      <h4 className="mb-1.5 flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h4>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

export function AnswerView({ a, streaming, onAsk }: { a: Answer; streaming?: string | undefined; onAsk: (q: string) => void }) {
  const [more, setMore] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const hasMore = a.known.length + a.unknown.length + a.doctorQuestions.length > 0;

  return (
    <div className="space-y-2.5">
      <p className="text-sm leading-relaxed">{a.summary}</p>

      {a.yourResult.length > 0 && (
        <Section title="Your result · from your report" icon={FileText} tone="report">
          {a.yourResult.map((f) => <p key={f.observation.resultId + f.observation.reportId}>{f.text}</p>)}
        </Section>
      )}

      {(a.meaning.length > 0 || streaming !== undefined) && (
        <Section title="What it means · general information" icon={BookOpen}>
          {streaming !== undefined && a.generatedBy === "library" ? (
            <p className="italic text-muted-foreground">{streaming || "Writing a plain-language explanation…"}</p>
          ) : (
            a.meaning.map((m) => <p key={m}>{m}</p>)
          )}
        </Section>
      )}

      {hasMore && (
        <button onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {more ? "Fewer details" : "More details"} <ChevronDown className={cn("h-4 w-4 transition-transform", more && "rotate-180")} />
        </button>
      )}
      {more && (
        <div className="fade-up space-y-2.5">
          {(a.known.length > 0 || a.unknown.length > 0) && (
            <Section title="What we know and don't know" icon={HelpCircle}>
              {a.known.map((k) => <p key={k}>• {k}</p>)}
              {a.unknown.map((k) => <p key={k} className="text-muted-foreground">? {k}</p>)}
            </Section>
          )}
          {a.doctorQuestions.length > 0 && (
            <Section title="Questions for your doctor" icon={HelpCircle}>
              {a.doctorQuestions.map((q) => <p key={q}>• {q}</p>)}
            </Section>
          )}
        </div>
      )}

      {(a.yourResult.length > 0 || a.references.length > 0) && (
        <div>
          <button onClick={() => setEvidence((e) => !e)} aria-expanded={evidence} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            Sources ({a.yourResult.length + a.references.length}) <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", evidence && "rotate-180")} />
          </button>
          {evidence && (
            <ul className="fade-up mt-1.5 space-y-1 text-xs text-muted-foreground">
              {a.yourResult.map((f) => (
                <li key={"s" + f.observation.resultId + f.observation.reportId}>
                  <FileText className="mr-1 inline h-3 w-3" />{f.observation.testName}
                  {f.observation.code && ` (LOINC ${f.observation.code})`} — {f.source}
                </li>
              ))}
              {a.references.map((r) => (
                <li key={r.url}>
                  <Library className="mr-1 inline h-3 w-3" />
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.title}</a> — {r.publisher} · {r.license}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {a.generatedBy === "model" ? <Cpu className="h-3 w-3" /> : <Library className="h-3 w-3" />}
        {a.modelNote ?? (a.generatedBy === "model" ? "Worded by on-device AI." : "Answered from your report and the reference library.")}
      </p>

      {a.followUps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {a.followUps.map((q) => (
            <button key={q} onClick={() => onAsk(q)} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs hover:bg-secondary">{q}</button>
          ))}
        </div>
      )}
    </div>
  );
}
