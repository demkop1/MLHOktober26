import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, Loader2, AlertCircle, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { VerifyTable } from "@/components/lab/VerifyTable";
import { parseLines, newId } from "@/lib/lab/parser";
import { sampleLines } from "@/lib/lab/sample";
import { saveReport } from "@/lib/lab/storage";
import type { ExtractedLine, LabResult } from "@/lib/lab/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  validateSearch: (s: Record<string, unknown>): { sample?: boolean; demo?: string } => ({
    ...(s["sample"] ? { sample: true } : {}),
    ...(typeof s["demo"] === "string" && DEMO_PDFS.includes(s["demo"]) ? { demo: s["demo"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Upload a lab report — Clearlab" },
      { name: "description", content: "Upload a PDF or image of your lab report. It is read on your device and never uploaded." },
      { property: "og:title", content: "Upload a lab report — Clearlab" },
      { property: "og:description", content: "Read your lab report privately, right in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

/** Synthetic PDFs served from /demo-reports — processed with the real PDF pipeline. */
export const DEMO_PDFS = ["baseline-2025-09", "followup-2026-03", "critical-flag-2026-04"];

type Stage = "pick" | "working" | "verify";

function UploadPage() {
  const { sample, demo } = Route.useSearch();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("pick");
  const [progress, setProgress] = useState({ msg: "", pct: 0 });
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LabResult[]>([]);
  const [unparsed, setUnparsed] = useState<ExtractedLine[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [meta, setMeta] = useState({ title: "", date: "", fileName: "" });
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const finish = useCallback((lines: ExtractedLine[], fileName: string, extraNotes: string[]) => {
    const p = parseLines(lines);
    setRows(p.results);
    setUnparsed(p.unparsed);
    setNotes(extraNotes);
    setMeta({ title: fileName.replace(/\.[^.]+$/, ""), date: p.reportDate ?? "", fileName });
    setStage("verify");
  }, []);

  useEffect(() => {
    if (sample) finish(sampleLines(), "Synthetic sample report", ["This is a synthetic sample report for demonstration."]);
  }, [sample, finish]);

  useEffect(() => {
    if (!demo) return;
    fetch(`/demo-reports/${demo}.pdf`)
      .then((r) => { if (!r.ok) throw new Error("Demo file missing"); return r.blob(); })
      .then((b) => handleFile(new File([b], `${demo}.pdf`, { type: "application/pdf" })))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the demo report."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const handleFile = async (file: File) => {
    setError(null);
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      setError("Please choose a PDF, PNG or JPEG file.");
      return;
    }
    setStage("working");
    try {
      const { extractFile } = await import("@/lib/lab/extract");
      const { lines, notes } = await extractFile(file, (msg, pct) => setProgress({ msg, pct }));
      if (lines.length === 0) throw new Error("No readable text was found in this file.");
      finish(lines, file.name, notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while reading the file.");
      setStage("pick");
    }
  };

  const save = async () => {
    setSaving(true);
    const unresolved = rows.filter((r) => r.needsReview).length;
    const limitations = [...notes];
    if (unparsed.length) limitations.push(`${unparsed.length} line(s) looked like results but could not be read automatically.`);
    if (unresolved) limitations.push(`${unresolved} value(s) were saved without being confirmed.`);
    const id = newId();
    await saveReport({
      id,
      title: meta.title || "Lab report",
      reportDate: meta.date || null,
      fileName: meta.fileName,
      createdAt: Date.now(),
      results: rows.filter((r) => r.name.trim()),
      limitations,
    });
    navigate({ to: "/report/$id", params: { id } });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold md:text-4xl">{stage === "verify" ? "Check what we read" : "Upload your lab report"}</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-status-in" /> Your file is read inside this browser and never sent anywhere.
      </p>

      {error && (
        <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {stage === "pick" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className={cn(
            "mt-8 flex flex-col items-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center shadow-soft transition-colors",
            drag ? "border-primary bg-secondary" : "border-border",
          )}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><UploadCloud className="h-7 w-7" /></span>
          <p className="mt-4 text-lg font-medium">Drag & drop your report here</p>
          <p className="text-sm text-muted-foreground">PDF, PNG or JPEG</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button className="rounded-full bg-gradient-brand" onClick={() => inputRef.current?.click()}>Choose file</Button>
            <Button variant="outline" className="rounded-full" onClick={() => finish(sampleLines(), "Synthetic sample report", ["This is a synthetic sample report for demonstration."])}>
              Use sample report
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            Synthetic PDFs:
            {DEMO_PDFS.map((d) => (
              <button key={d} className="underline hover:text-foreground" onClick={() => navigate({ to: "/upload", search: { demo: d } })}>{d}</button>
            ))}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
          <p className="mt-6 max-w-md text-xs text-muted-foreground">
            Reading scanned images needs a one-time download of the text-recognition engine. Your report itself is never uploaded.
          </p>
        </div>
      )}

      {stage === "working" && (
        <div className="mt-8 rounded-3xl border border-border bg-card p-10 text-center shadow-soft" aria-live="polite">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 font-medium">{progress.msg || "Preparing…"}</p>
          <Progress value={progress.pct} className="mx-auto mt-4 max-w-sm" />
        </div>
      )}

      {stage === "verify" && (
        <div className="mt-8 space-y-6">
          <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:grid-cols-2">
            <label className="text-sm">Report name<Input className="mt-1" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></label>
            <label className="text-sm">Report date<Input className="mt-1" placeholder="Not found — enter if known" value={meta.date} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></label>
          </div>

          {[...notes, rows.length === 0 ? "We couldn't recognise any results automatically. You can add them manually below." : null]
            .filter(Boolean)
            .map((n) => (
              <p key={n} className="flex gap-2 rounded-xl bg-accent p-3 text-sm text-accent-foreground"><Info className="h-4 w-4 shrink-0" />{n}</p>
            ))}

          <p className="text-sm text-muted-foreground">
            Compare each row with your paper report and fix anything that looks wrong. Rows outlined in orange were hard to read — please confirm them.
          </p>
          <VerifyTable rows={rows} onChange={setRows} />

          {unparsed.length > 0 && (
            <details className="rounded-2xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium">{unparsed.length} line(s) we couldn't read as results</summary>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {unparsed.map((l, i) => <li key={i}>Page {l.page}: {l.text}</li>)}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => { setStage("pick"); setRows([]); navigate({ to: "/upload", search: {} }); }}>Start over</Button>
            <Button className="rounded-full bg-gradient-brand px-6" disabled={saving || rows.length === 0} onClick={save}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save & view results
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
