import { sameTest } from "@/lib/ai/retrieval";
import { normalizeUnit } from "./engine";
import type { LabReport, LabResult } from "./types";

export interface TrendPoint {
  reportId: string;
  date: string;
  time: number;
  value: number;
  valueRaw: string;
}

export interface Trend {
  points: TrendPoint[];
  /** Why no chart is shown, if applicable. */
  reason: string | null;
}

const timeOf = (r: LabReport) => (r.reportDate ? Date.parse(r.reportDate) : NaN) || r.createdAt;

/** History for one result, using only earlier/later reports with the same test AND the same unit. */
export function trendFor(result: LabResult, current: LabReport, all: LabReport[]): Trend {
  const points: TrendPoint[] = [];
  let unitMismatch = false;
  let nonNumeric = false;
  for (const rep of all.some((r) => r.id === current.id) ? all : [...all, current]) {
    const r = rep.id === current.id ? result : rep.results.find((x) => sameTest(x, result));
    if (!r) continue;
    if (normalizeUnit(r.unit) !== normalizeUnit(result.unit)) { unitMismatch = true; continue; }
    if (r.value === null || r.comparator) { nonNumeric = true; continue; }
    points.push({ reportId: rep.id, date: rep.reportDate ?? new Date(rep.createdAt).toISOString().slice(0, 10), time: timeOf(rep), value: r.value, valueRaw: r.valueRaw });
  }
  points.sort((a, b) => a.time - b.time);
  if (points.length >= 2) return { points, reason: null };
  return {
    points,
    reason: unitMismatch
      ? "Earlier reports use a different unit, so no trend is shown."
      : nonNumeric
        ? "Some values aren't exact numbers, so no trend is shown."
        : "No earlier report on this device has this test yet.",
  };
}
