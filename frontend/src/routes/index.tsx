import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  HelpCircle,
  ImageIcon,
  Info,
  Leaf,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { interpretReportFn } from "@/lib/interpret.functions";
import type { Concept, Interpretation } from "@/lib/report-schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LabLens — Your lab report, explained simply" },
      {
        name: "description",
        content: "Paste or photograph your lab report and get a clear, plain-language explanation of every result.",
      },
      { property: "og:title", content: "LabLens — Your lab report, explained simply" },
      {
        property: "og:description",
        content: "AI-powered explanations of blood tests and lab results, written for patients.",
      },
    ],
  }),
  component: Index,
});

const SAMPLE = `COMPLETE BLOOD COUNT & METABOLIC PANEL
Patient: J. Doe    Collected: 2026-10-21

Hemoglobin            11.2 g/dL      (13.5 – 17.5)   L
Hematocrit            34 %           (40 – 52)       L
MCV                   76 fL          (80 – 100)      L
White Blood Cells     7.1 x10^9/L    (4.0 – 11.0)
Platelets             265 x10^9/L    (150 – 400)
Ferritin              9 ng/mL        (30 – 400)      L
Fasting Glucose       98 mg/dL       (70 – 99)
LDL Cholesterol       162 mg/dL      (< 130)         H
HDL Cholesterol       48 mg/dL       (> 40)
TSH                   2.1 mIU/L      (0.4 – 4.0)

Comment: Findings consistent with microcytic anemia; suggest iron studies follow-up.`;

const STATUS_META: Record<Interpretation["overall_status"], { label: string; icon: ReactNode; cls: string }> = {
  reassuring: { label: "Mostly reassuring", icon: <CheckCircle2 className="size-4" />, cls: "bg-status-normal-soft text-status-normal" },
  some_attention: { label: "A few things to note", icon: <Info className="size-4" />, cls: "bg-status-flag-soft text-status-flag" },
  needs_attention: { label: "Worth discussing soon", icon: <TriangleAlert className="size-4" />, cls: "bg-status-flag-soft text-status-flag" },
};

const isFlag = (s: Concept["status"]) => s === "low" || s === "high" || s === "abnormal";

function Index() {
  const interpret = useServerFn(interpretReportFn);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [tab, setTab] = useState("text");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Interpretation | null>(null);
  const [submittedText, setSubmittedText] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const conceptRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onFile = (f?: File) => {
    if (!f) return;
    if (f.size > 6_000_000) return setError("Image is too large (max 6 MB).");
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(f);
  };

  const run = async () => {
    setError(null);
    setLoading(true);
    const useText = tab === "text" ? text : "";
    const useImage = tab === "image" ? image : null;
    try {
      const r = await interpret({ data: { text: useText || undefined, image: useImage || undefined } });
      setResult(r);
      setSubmittedText(useText);
      setActive(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const focusConcept = (i: number) => {
    setActive(i);
    conceptRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const canRun = tab === "text" ? text.trim().length > 10 : !!image;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" />
          </div>
          <span className="font-display text-xl font-semibold">LabLens</span>
        </div>
        {result && (
          <Button variant="ghost" size="sm" onClick={() => { setResult(null); setError(null); }}>
            <RotateCcw /> New report
          </Button>
        )}
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-2">
        {/* LEFT */}
        <section className="flex flex-col gap-6">
          {!result ? (
            <>
              <div className="pt-4 lg:pt-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  <Sparkles className="size-3.5" /> AI-powered explanations
                </span>
                <h1 className="mt-4 text-4xl font-semibold leading-[1.05] md:text-5xl">
                  Your lab report,<br />
                  <span className="text-sage">finally in plain words.</span>
                </h1>
                <p className="mt-4 max-w-md text-muted-foreground">
                  Paste your results or snap a photo. We'll explain the big picture and every term — no medical
                  dictionary needed.
                </p>
              </div>

              <div className="rounded-3xl border bg-card p-5 shadow-soft">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="text"><FileText /> Paste text</TabsTrigger>
                    <TabsTrigger value="image"><ImageIcon /> Upload photo</TabsTrigger>
                  </TabsList>
                  <TabsContent value="text">
                    <Textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste your lab report here…"
                      className="min-h-64 resize-none rounded-xl bg-cream font-mono text-sm"
                    />
                    <button
                      onClick={() => setText(SAMPLE)}
                      className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Try a sample report
                    </button>
                  </TabsContent>
                  <TabsContent value="image">
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                    {image ? (
                      <div className="relative overflow-hidden rounded-xl border bg-cream">
                        <img src={image} alt="Uploaded report" className="max-h-80 w-full object-contain" />
                        <Button size="icon" variant="secondary" className="absolute right-2 top-2" onClick={() => setImage(null)}>
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
                        className="flex min-h-64 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-cream text-muted-foreground transition-colors hover:border-sage hover:text-foreground"
                      >
                        <Upload className="size-8" />
                        <span className="text-sm">Drop a photo of your report, or click to choose</span>
                      </button>
                    )}
                  </TabsContent>
                </Tabs>
                {error && <p className="mt-3 rounded-lg bg-status-flag-soft px-3 py-2 text-sm text-status-flag">{error}</p>}
                <Button size="lg" className="mt-4 w-full rounded-xl" disabled={!canRun || loading} onClick={run}>
                  {loading ? "Reading your report…" : <>Explain my report <ArrowRight /></>}
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border bg-card p-6 shadow-soft lg:sticky lg:top-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your report</h2>
                <span className="text-xs text-muted-foreground">Tap a highlighted term</span>
              </div>
              {submittedText ? (
                <HighlightedReport text={submittedText} concepts={result.concepts} onPick={focusConcept} />
              ) : image ? (
                <img src={image} alt="Your report" className="w-full rounded-xl border" />
              ) : null}
            </div>
          )}
        </section>

        {/* RIGHT */}
        <section className="flex flex-col gap-5 lg:pt-10">
          {loading ? (
            <LoadingState />
          ) : result ? (
            result.is_lab_report ? (
              <Results result={result} active={active} setActive={setActive} conceptRefs={conceptRefs} />
            ) : (
              <div className="rounded-3xl border bg-card p-8 shadow-soft">
                <h2 className="text-xl font-semibold">This doesn't look like a lab report</h2>
                <p className="mt-2 text-muted-foreground">Try pasting the results section of your report, or a clearer photo.</p>
              </div>
            )
          ) : (
            <Preview />
          )}
        </section>
      </main>
    </div>
  );
}

function HighlightedReport({ text, concepts, onPick }: { text: string; concepts: Concept[]; onPick: (i: number) => void }) {
  const parts = useMemo(() => {
    const items = concepts
      .map((c, i) => ({ name: c.name.trim(), i }))
      .filter((c) => c.name.length > 1)
      .sort((a, b) => b.name.length - a.name.length);
    if (!items.length) return [text];
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${items.map((c) => esc(c.name)).join("|")})`, "gi");
    const used = new Set<number>();
    return text.split(re).map((part, k) => {
      const hit = items.find((c) => c.name.toLowerCase() === part.toLowerCase());
      if (!hit || used.has(hit.i)) return part;
      used.add(hit.i);
      return (
        <mark
          key={k}
          onClick={() => onPick(hit.i)}
          className={cn("concept-mark text-foreground", isFlag(concepts[hit.i]?.status ?? "info") && "concept-mark-flag")}
        >
          {part}
        </mark>
      );
    });
  }, [text, concepts, onPick]);

  return <pre className="whitespace-pre-wrap rounded-xl bg-cream p-4 font-mono text-[13px] leading-7">{parts}</pre>;
}

function Results({
  result,
  active,
  setActive,
  conceptRefs,
}: {
  result: Interpretation;
  active: number | null;
  setActive: (i: number | null) => void;
  conceptRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}) {
  const meta = STATUS_META[result.overall_status];
  const flagged = result.concepts.filter((c) => isFlag(c.status)).length;

  return (
    <>
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", meta.cls)}>
          {meta.icon} {meta.label}
        </span>
        <h2 className="mt-3 text-2xl font-semibold">{result.title}</h2>
        <p className="mt-3 leading-relaxed text-foreground/85">{result.summary}</p>
        <div className="mt-5 flex gap-3 text-sm">
          <Stat n={result.concepts.length} label="terms explained" />
          <Stat n={flagged} label="outside range" flag={flagged > 0} />
        </div>
      </div>

      <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-soft">
        <h3 className="font-semibold">Key takeaways</h3>
        <ul className="mt-3 space-y-2">
          {result.key_takeaways.map((t, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary-foreground/70" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 px-1 text-lg font-semibold">Every term, explained</h3>
        <div className="space-y-3">
          {result.concepts.map((c, i) => (
            <div
              key={i}
              ref={(el) => { conceptRefs.current[i] = el; }}
              className={cn(
                "rounded-2xl border bg-card transition-all",
                active === i ? "border-sage shadow-soft ring-2 ring-sage/30" : "hover:border-sage/60",
              )}
            >
              <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setActive(active === i ? null : i)}>
                <StatusPill status={c.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-semibold">{c.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{c.plain_name}</div>
                </div>
                {c.value && (
                  <div className="text-right">
                    <div className="font-display font-semibold">
                      {c.value} <span className="text-xs font-normal text-muted-foreground">{c.unit}</span>
                    </div>
                    {c.reference_range && <div className="text-xs text-muted-foreground">ref {c.reference_range}</div>}
                  </div>
                )}
              </button>
              {active === i && (
                <div className="animate-in fade-in slide-in-from-top-1 space-y-3 border-t px-4 pb-4 pt-3 text-sm leading-relaxed">
                  <p><span className="font-semibold">What it is. </span>{c.explanation}</p>
                  <p className="rounded-xl bg-cream p-3"><span className="font-semibold">Your result. </span>{c.why_it_matters}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h3 className="flex items-center gap-2 font-semibold"><HelpCircle className="size-5 text-sage" /> Questions to ask your doctor</h3>
        <ol className="mt-3 space-y-2">
          {result.questions_for_doctor.map((q, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{i + 1}</span>
              <span className="pt-0.5">{q}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        LabLens is for education only and is not medical advice. Always review your results with a qualified healthcare professional.
      </p>
    </>
  );
}

function Stat({ n, label, flag }: { n: number; label: string; flag?: boolean }) {
  return (
    <div className={cn("flex-1 rounded-xl px-4 py-3", flag ? "bg-status-flag-soft" : "bg-muted")}>
      <div className={cn("font-display text-2xl font-semibold", flag && "text-status-flag")}>{n}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Concept["status"] }) {
  const map = {
    low: ["Low", "bg-status-flag-soft text-status-flag"],
    high: ["High", "bg-status-flag-soft text-status-flag"],
    abnormal: ["Flag", "bg-status-flag-soft text-status-flag"],
    normal: ["Normal", "bg-status-normal-soft text-status-normal"],
    info: ["Term", "bg-status-info-soft text-status-info"],
  } as const;
  const [label, cls] = map[status];
  return <span className={cn("w-16 shrink-0 rounded-full py-1 text-center text-xs font-semibold", cls)}>{label}</span>;
}

function LoadingState() {
  return (
    <div className="rounded-3xl border bg-card p-8 shadow-soft">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 rounded-full bg-sage animate-pulse-dot" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <h2 className="mt-4 text-xl font-semibold">Reading your report…</h2>
      <p className="mt-1 text-muted-foreground">Translating medical terms into everyday language. This takes about 20 seconds.</p>
      <div className="mt-6 space-y-3">
        {[80, 95, 60].map((w, i) => (
          <div key={i} className="h-3 animate-pulse rounded-full bg-muted" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

function Preview() {
  const steps = [
    { icon: <FileText className="size-5" />, t: "Add your report", d: "Paste the text or upload a photo." },
    { icon: <Sparkles className="size-5" />, t: "Get the big picture", d: "A calm, clear summary of what it says." },
    { icon: <Leaf className="size-5" />, t: "Understand every term", d: "Tap any result to see what it means for you." },
  ];
  return (
    <div className="rounded-3xl border bg-card/70 p-8 shadow-soft backdrop-blur lg:mt-[7.5rem]">
      <h2 className="text-xl font-semibold">How it works</h2>
      <div className="mt-6 space-y-5">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground">{s.icon}</div>
            <div>
              <div className="font-display font-semibold">{s.t}</div>
              <div className="text-sm text-muted-foreground">{s.d}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        For education only — not a diagnosis. Your report is processed securely and not stored.
      </p>
    </div>
  );
}
