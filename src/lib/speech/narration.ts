import type { Answer } from "@/lib/ai/answer";
import { classify, STATUS_LABEL } from "@/lib/lab/engine";
import { explain } from "@/lib/lab/explanations";
import type { LabReport, LabResult } from "@/lib/lab/types";

export const MAX_NARRATION_CHARS = 600;

const nums = (s: string) => [...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(",", "."));

/** Numbers in `spoken` that don't appear in `allowedSource`. Must be empty before anything is spoken. */
export function inventedNumbers(spoken: string, allowedSource: string): string[] {
  const allowed = new Set(nums(allowedSource));
  return [...new Set(nums(spoken).filter((n) => !allowed.has(n)))];
}

function clip(text: string, max = MAX_NARRATION_CHARS) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return (end > 80 ? cut.slice(0, end + 1) : cut).trim();
}

/** Make units and symbols easier to hear. Never changes digits. */
export function speakable(text: string) {
  return text
    .replace(/10\^3\/uL/g, "thousand per microliter")
    .replace(/g\/dL/g, "grams per deciliter")
    .replace(/mg\/dL/g, "milligrams per deciliter")
    .replace(/mmol\/L/g, "millimoles per liter")
    .replace(/ng\/mL/g, "nanograms per milliliter")
    .replace(/mIU\/L/g, "milli units per liter")
    .replace(/mg\/L/g, "milligrams per liter")
    .replace(/<\s?=?/g, "less than ")
    .replace(/>\s?=?/g, "more than ")
    .replace(/(\d)\s?-\s?(\d)/g, "$1 to $2")
    .replace(/—/g, ",");
}

export function answerNarration(a: Answer): string {
  const meaning = a.meaning[0] ?? "";
  return clip(speakable([a.summary, meaning].filter(Boolean).join(" ")));
}

export function resultNarration(r: LabResult): string {
  const c = classify(r);
  const ex = explain(r.name);
  const range = r.rangeRaw ? `Your lab's range is ${r.rangeRaw}.` : "The report doesn't show a range for this test.";
  const status = c.status === "unknown" ? "It couldn't be compared with a range." : `That's ${STATUS_LABEL[c.status].toLowerCase()}.`;
  const crit = r.critical ? " The lab marked this result as critical. Please follow your lab's or clinician's instructions." : "";
  return clip(speakable(`${r.name}: ${r.valueRaw} ${r.unit}. ${range} ${status}${crit} ${ex ? ex.what : ""}`));
}

export interface OverviewCounts {
  below: number;
  within: number;
  above: number;
  unknown: number;
  needsChecking: number;
  critical: number;
  total: number;
}

export function overviewCounts(report: LabReport): OverviewCounts {
  const c: OverviewCounts = { below: 0, within: 0, above: 0, unknown: 0, needsChecking: 0, critical: 0, total: report.results.length };
  for (const r of report.results) {
    const s = classify(r).status;
    c[s]++;
    if (r.needsReview || s === "unknown") c.needsChecking++;
    if (r.critical) c.critical++;
  }
  return c;
}

export function overviewNarration(report: LabReport): string {
  const c = overviewCounts(report);
  const parts = [
    `This report has ${c.total} results.`,
    `${c.above} are above and ${c.below} are below the ranges printed by your lab, and ${c.within} are within them.`,
    c.unknown ? `${c.unknown} couldn't be compared.` : "",
    c.critical ? `The lab marked ${c.critical} result${c.critical > 1 ? "s" : ""} as critical. Please follow your lab's or clinician's instructions.` : "",
    "Being inside or outside a range is not a diagnosis. Tap a result to hear more.",
  ];
  return clip(parts.filter(Boolean).join(" "));
}
