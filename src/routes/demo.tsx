import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newId, parseLines } from "@/lib/lab/parser";
import { saveReport } from "@/lib/lab/storage";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Guided demo — Clearlab" },
      { name: "description", content: "Walk through Clearlab with synthetic lab reports: upload, verify, overview, explain, ask, listen and check privacy." },
      { property: "og:title", content: "Guided demo — Clearlab" },
      { property: "og:description", content: "A nine-step tour using synthetic lab reports and real on-device processing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DemoPage,
});

const STEPS = [
  { t: "Upload a synthetic blood test", d: "Opens the March 2026 synthetic PDF and reads it with the real PDF reader." },
  { t: "Extract and verify the measurements", d: "Compare each row with the PDF, fix anything wrong, then press Save & view results." },
  { t: "See the interactive overview", d: "Counts below / within / above the lab's range, plus anything that needs checking." },
  { t: "Explain an out-of-range result", d: "On the Hemoglobin or LDL card, press “Explain this result”." },
  { t: "Ask a follow-up by chat or voice", d: "Type or use the microphone, e.g. “How does this compare with my previous report?”." },
  { t: "See the evidence", d: "Open “Sources” under the answer: report rows with page numbers and reference links." },
  { t: "Grounded answer from local AI", d: "Turn on Gemma 4 in the panel (desktop Chrome/Edge with WebGPU). Without it, the library answer is shown and labeled." },
  { t: "Narrate the answer", d: "Press the speaker on an answer or card. Kokoro speaks on this device." },
  { t: "Confirm data stays on-device", d: "Open the Privacy page: storage, services in use and model downloads are shown live." },
];

function DemoPage() {
  const [baseline, setBaseline] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  const addBaseline = async () => {
    setBaseline("busy"); setErr(null);
    try {
      const blob = await (await fetch("/demo-reports/baseline-2025-09.pdf")).blob();
      const { extractFile } = await import("@/lib/lab/extract");
      const { lines } = await extractFile(new File([blob], "baseline-2025-09.pdf", { type: "application/pdf" }), () => {});
      const p = parseLines(lines);
      if (!p.results.length) throw new Error("No results could be read from the PDF.");
      await saveReport({
        id: newId(), title: "Synthetic report — September 2025", reportDate: p.reportDate, fileName: "baseline-2025-09.pdf",
        createdAt: Date.now(), results: p.results,
        limitations: ["Synthetic demo report, saved without the manual checking step."],
      });
      setBaseline("done");
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); setBaseline("error"); }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold md:text-4xl">Guided demo</h1>
      <p className="mt-2 text-muted-foreground">Uses only synthetic (made-up) patients. Every step runs the real processing — nothing is pre-recorded.</p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <p className="text-sm font-medium">Optional: add an earlier report first so comparisons and trend charts have history.</p>
        <Button variant="outline" className="mt-3 rounded-full" disabled={baseline === "busy" || baseline === "done"} onClick={addBaseline}>
          {baseline === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : baseline === "done" ? <CheckCircle2 className="h-4 w-4 text-status-in" /> : null}
          {baseline === "done" ? "September 2025 report added" : "Add September 2025 synthetic report"}
        </Button>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      </div>

      <ol className="mt-6 space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.t} className="fade-up flex gap-4 rounded-2xl border border-border bg-card p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-brand font-semibold text-primary-foreground">{i + 1}</span>
            <div><p className="font-medium">{s.t}</p><p className="text-sm text-muted-foreground">{s.d}</p></div>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg" className="rounded-full bg-gradient-brand"><Link to="/upload" search={{ demo: "followup-2026-03" }}><PlayCircle className="h-4 w-4" /> Start: upload the March 2026 PDF</Link></Button>
        <Button asChild variant="outline" size="lg" className="rounded-full"><Link to="/upload" search={{ demo: "critical-flag-2026-04" }}>Try the lab-critical example</Link></Button>
        <Button asChild variant="ghost" size="lg" className="rounded-full"><Link to="/privacy">Privacy page</Link></Button>
      </div>
    </main>
  );
}
