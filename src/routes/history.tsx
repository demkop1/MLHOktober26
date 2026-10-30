import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Trash2, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { classify } from "@/lib/lab/engine";
import { deleteReport, exportReport, listReports } from "@/lib/lab/storage";
import type { LabReport } from "@/lib/lab/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My reports — Clearlab" },
      { name: "description", content: "Lab reports stored encrypted on this device." },
      { property: "og:title", content: "My reports — Clearlab" },
      { property: "og:description", content: "Review, export or delete lab reports saved on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [reports, setReports] = useState<LabReport[] | null>(null);
  const load = () => listReports().then(setReports).catch(() => setReports([]));
  useEffect(() => { load(); }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold md:text-4xl">My reports</h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Encrypted and stored only in this browser.</p>

      {reports && reports.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No reports saved yet.</p>
          <Button asChild className="mt-4 rounded-full bg-gradient-brand"><Link to="/upload">Upload a report</Link></Button>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {reports?.map((r) => {
          const flagged = r.results.filter((x) => ["above", "below"].includes(classify(x).status)).length;
          return (
            <li key={r.id} className="fade-up flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><FileText className="h-5 w-5" /></span>
              <Link to="/report/$id" params={{ id: r.id }} className="min-w-0 flex-1">
                <p className="truncate font-medium hover:underline">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.reportDate ?? "No date"} · {r.results.length} results · {flagged} outside range
                </p>
              </Link>
              <Button size="icon" variant="ghost" aria-label="Export" onClick={() => exportReport(r)}><Download className="h-4 w-4" /></Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete"
                onClick={async () => { if (confirm(`Delete "${r.title}" from this device?`)) { await deleteReport(r.id); load(); } }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
