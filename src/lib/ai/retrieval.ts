import { classify, normalizeUnit, STATUS_LABEL } from "@/lib/lab/engine";
import type { LabReport, LabResult, Status } from "@/lib/lab/types";
import { findKnowledgeForTest, mentions } from "./knowledge";

/** One patient-specific fact, always copied verbatim from the stored report. */
export interface Observation {
  resultId: string;
  reportId: string;
  testName: string;
  code: string | null;
  codeSystem: "LOINC" | null;
  valueRaw: string;
  unit: string;
  rangeRaw: string;
  flag: string | null;
  status: Status;
  statusLabel: string;
  reportTitle: string;
  reportDate: string | null;
  fileName: string;
  page: number | null;
  verification: "confirmed" | "unconfirmed";
  confidence: number | null;
}

export function toObservation(r: LabResult, report: LabReport): Observation {
  const kb = findKnowledgeForTest(r.name);
  const status = classify(r).status;
  return {
    resultId: r.id,
    reportId: report.id,
    testName: r.name,
    code: kb?.loinc ?? null,
    codeSystem: kb?.loinc ? "LOINC" : null,
    valueRaw: r.valueRaw,
    unit: r.unit,
    rangeRaw: r.rangeRaw,
    flag: r.flag,
    status,
    statusLabel: STATUS_LABEL[status],
    reportTitle: report.title,
    reportDate: report.reportDate,
    fileName: report.fileName,
    page: r.page,
    verification: r.needsReview ? "unconfirmed" : "confirmed",
    confidence: r.confidence,
  };
}

/** Human-readable fact line. Numbers are inserted as the exact strings from the report. */
export function factText(o: Observation): string {
  const value = `${o.valueRaw}${o.unit ? ` ${o.unit}` : ""}`;
  const range = o.rangeRaw ? `lab range ${o.rangeRaw}${o.unit ? ` ${o.unit}` : ""}` : "no range on report";
  return `${o.testName}: ${value} (${range}) — ${o.statusLabel}`;
}

export function sourceText(o: Observation): string {
  return [o.reportTitle, o.reportDate ?? "date unknown", o.page ? `page ${o.page}` : "added manually", o.verification]
    .join(" · ");
}

/** Which tests from this report does the question refer to? Exact structured lookup, no embeddings. */
export function matchResults(question: string, report: LabReport): LabResult[] {
  const q = question.toLowerCase();
  return report.results.filter((r) => {
    const name = r.name.toLowerCase().trim();
    if (name.length >= 3 && q.includes(name)) return true;
    const kb = findKnowledgeForTest(r.name);
    if (!kb) return false;
    // A general word like "cholesterol" matches every cholesterol row.
    return kb.aliases.some((a) => mentions(question, a)) || (/cholesterol/.test(q) && /cholesterol|ldl|hdl/.test(name));
  });
}

export const sameTest = (a: LabResult, b: LabResult) => {
  const ka = findKnowledgeForTest(a.name)?.id;
  const kb = findKnowledgeForTest(b.name)?.id;
  return ka && kb ? ka === kb : a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
};

export interface Comparison {
  current: Observation;
  previous: Observation | null;
  note: string;
}

const reportTime = (r: LabReport) => (r.reportDate ? Date.parse(r.reportDate) : NaN) || r.createdAt;

/** Pair each selected result with the same test on the most recent earlier report. */
export function compareWithPrevious(current: LabReport, targets: LabResult[], all: LabReport[]): Comparison[] {
  const earlier = all
    .filter((r) => r.id !== current.id && reportTime(r) < reportTime(current))
    .sort((a, b) => reportTime(b) - reportTime(a));
  return targets.map((t) => {
    const cur = toObservation(t, current);
    for (const rep of earlier) {
      const prev = rep.results.find((p) => sameTest(p, t));
      if (!prev) continue;
      const po = toObservation(prev, rep);
      if (normalizeUnit(prev.unit) !== normalizeUnit(t.unit))
        return { current: cur, previous: po, note: `Units differ (${prev.unit || "none"} vs ${t.unit || "none"}), so the values aren't compared.` };
      if (prev.rangeRaw !== t.rangeRaw)
        return { current: cur, previous: po, note: "The lab's reference range changed between reports, so compare with care." };
      return { current: cur, previous: po, note: "Same unit and range on both reports." };
    }
    return { current: cur, previous: null, note: "No earlier report on this device includes this test." };
  });
}
