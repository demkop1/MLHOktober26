import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Info, Loader2, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChatPanel, type ChatRequest } from "@/components/lab/chat/ChatPanel";
import { ResultCard, STATUS_STYLE } from "@/components/lab/ResultCard";
import { ReportOverview } from "@/components/lab/ReportOverview";
import { classify, STATUS_LABEL } from "@/lib/lab/engine";
import { exportReport, getReport, listReports } from "@/lib/lab/storage";
import { trendFor } from "@/lib/lab/trends";
import type { LabReport, LabResult, Status } from "@/lib/lab/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/report/$id")({
  head: () => ({
    meta: [
      { title: "Your results — Clearlab" },
      { name: "description", content: "Your lab results explained in plain language, stored only on this device." },
      { property: "og:title", content: "Your results — Clearlab" },
      { property: "og:description", content: "Lab results explained in plain language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportPage,
});

const ORDER: Status[] = ["above", "below", "unknown", "within"];

function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

function ReportPage() {
  const { id } = Route.useParams();
  const [report, setReport] = useState<LabReport | null | undefined>(undefined);
  const [all, setAll] = useState<LabReport[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [chatOpen, setChatOpen] = useState(false);
  const [request, setRequest] = useState<ChatRequest | null>(null);
  const wide = useIsWide();

  useEffect(() => {
    setChatOpen(false);
    getReport(id).then(setReport).catch(() => setReport(null));
    listReports().then(setAll).catch(() => setAll([]));
  }, [id]);

  if (report === undefined)
    return <div className="grid min-h-[50vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Loading report" /></div>;
  if (report === null)
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">Report not found on this device</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/history">See my reports</Link></Button>
      </main>
    );

  const withStatus = report.results.map((r) => ({ r, s: classify(r).status }));
  const counts = ORDER.reduce((a, s) => ({ ...a, [s]: withStatus.filter((x) => x.s === s).length }), {} as Record<Status, number>);
  const shown = withStatus
    .filter((x) => filter === "all" || x.s === filter)
    .sort((a, b) => Number(!!b.r.critical) - Number(!!a.r.critical) || ORDER.indexOf(a.s) - ORDER.indexOf(b.s));

  const openChat = (q?: string, mode: ChatRequest["mode"] = "ask") => {
    if (q) setRequest({ q, mode, nonce: Date.now() });
    setChatOpen(true);
  };
  const explainR = (r: LabResult) => openChat(`Can you explain my ${r.name}?`);
  const followR = (r: LabResult) => openChat(`About my ${r.name}: `, "prefill");
  const jump = (rid: string) => document.getElementById(`card-${rid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  const panel = <ChatPanel report={report} request={request} />;

  return (
    <main className={cn("mx-auto px-4 py-10 transition-[max-width] duration-300", chatOpen && wide ? "max-w-[1400px]" : "max-w-6xl")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{report.reportDate ? `Report date ${report.reportDate}` : "Report date not found"}</p>
          <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{report.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-full bg-gradient-brand shadow-soft" onClick={() => setChatOpen((o) => !o)} aria-expanded={chatOpen}>
            <MessageCircle className="h-4 w-4" /> {chatOpen ? "Hide questions" : "Ask about this report"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => exportReport(report)}><Download className="h-4 w-4" /> Export</Button>
        </div>
      </div>

      <div className={cn("mt-6 grid gap-6", chatOpen && wide && "grid-cols-[minmax(0,1fr)_420px]")}>
        <div className="min-w-0 space-y-6">
          <ReportOverview report={report} onJump={jump} />

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter results">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All · {withStatus.length}</FilterChip>
            {ORDER.map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} className={STATUS_STYLE[s]}>{STATUS_LABEL[s]} · {counts[s]}</FilterChip>
            ))}
          </div>

          {report.limitations.length > 0 && (
            <div className="space-y-1 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
              {report.limitations.map((l) => <p key={l} className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" />{l}</p>)}
            </div>
          )}

          <section aria-label="Results" className={cn("grid gap-4 sm:grid-cols-2", !(chatOpen && wide) && "lg:grid-cols-3")}>
            {shown.map(({ r }, i) => (
              <div key={r.id} id={`card-${r.id}`} className="scroll-mt-24">
                <ResultCard r={r} index={i} trend={trendFor(r, report, all)} onExplain={explainR} onFollowUp={followR} />
              </div>
            ))}
          </section>

          <p className="text-center text-xs text-muted-foreground">
            "Within Range" only means the value is inside the range printed by your lab — it doesn't mean everything is fine, and outside doesn't mean something is wrong. Talk to your clinician about your results.
          </p>
        </div>

        {chatOpen && wide && (
          <aside aria-label="Questions about this report" className="fade-up sticky top-20 flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-soft">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold">Ask about your results</h2>
                <p className="text-xs text-muted-foreground">Facts come only from your report. Everything stays on this device.</p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Close questions" onClick={() => setChatOpen(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="min-h-0 flex-1">{panel}</div>
          </aside>
        )}
      </div>

      {!wide && (
        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
          <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle>Ask about your results</SheetTitle>
              <SheetDescription>Facts come only from your report. Everything stays on this device.</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1">{panel}</div>
          </SheetContent>
        </Sheet>
      )}
    </main>
  );
}

function FilterChip({ active, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      aria-pressed={active}
      {...p}
      className={cn("rounded-full border px-3 py-1 text-sm font-medium transition", active ? "border-foreground/40 ring-2 ring-ring/30" : "border-transparent", className ?? "bg-secondary text-secondary-foreground")}
    />
  );
}
