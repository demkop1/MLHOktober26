import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { newId, parseFlag, parseRange, toNum } from "@/lib/lab/parser";
import type { Comparator, LabResult } from "@/lib/lab/types";
import { cn } from "@/lib/utils";

function applyValue(raw: string): Pick<LabResult, "valueRaw" | "value" | "comparator"> {
  const m = raw.trim().match(/^([<>]=?)?\s*(-?\d+(?:[.,]\d+)?)$/);
  return m
    ? { valueRaw: raw.trim(), value: toNum(m[2]), comparator: (m[1] ?? null) as Comparator }
    : { valueRaw: raw.trim(), value: null, comparator: null };
}

export function VerifyTable({ rows, onChange }: { rows: LabResult[]; onChange: (r: LabResult[]) => void }) {
  const update = (id: string, patch: Partial<LabResult>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[2fr_1fr_1fr_1.3fr_0.6fr_auto] gap-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
        <span>Test</span><span>Result</span><span>Unit</span><span>Reference range</span><span>Flag</span><span />
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className={cn(
            "grid grid-cols-2 gap-2 rounded-xl border bg-card p-2 md:grid-cols-[2fr_1fr_1fr_1.3fr_0.6fr_auto]",
            r.needsReview ? "border-status-high" : "border-border",
          )}
        >
          <Input aria-label="Test name" className="col-span-2 md:col-span-1" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
          <Input aria-label="Result" value={r.valueRaw} onChange={(e) => update(r.id, applyValue(e.target.value))} />
          <Input aria-label="Unit" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} />
          <Input
            aria-label="Reference range"
            placeholder="e.g. 4.0 - 11.0"
            value={r.rangeRaw}
            onChange={(e) => {
              const pr = parseRange(e.target.value);
              update(r.id, { rangeRaw: e.target.value, rangeLow: pr.low, rangeHigh: pr.high });
            }}
          />
          <Input aria-label="Lab flag" placeholder="H / L" value={r.flag ?? ""} onChange={(e) => update(r.id, { flag: parseFlag(e.target.value) })} />
          <div className="flex items-center gap-1">
            {r.needsReview && (
              <Button size="sm" variant="outline" onClick={() => update(r.id, { needsReview: false })} title="Mark as checked">
                <AlertTriangle className="h-4 w-4 text-status-high" /> Confirm
              </Button>
            )}
            <Button size="icon" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => onChange(rows.filter((x) => x.id !== r.id))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="col-span-full px-1 text-[11px] text-muted-foreground">
            {r.page ? `Page ${r.page}` : "Manual"}
            {r.confidence !== null && ` · OCR confidence ${r.confidence}%`}
            {r.sourceLine && ` · read as “${r.sourceLine}”`}
          </p>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          onChange([
            ...rows,
            { id: newId(), name: "", valueRaw: "", value: null, comparator: null, unit: "", rangeRaw: "", rangeLow: null, rangeHigh: null, rangeUnit: "", flag: null, page: null, confidence: null, needsReview: false, sourceLine: "" },
          ])
        }
      >
        <Plus className="h-4 w-4" /> Add a result manually
      </Button>
    </div>
  );
}
