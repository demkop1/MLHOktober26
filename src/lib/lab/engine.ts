import type { LabResult, Status } from "./types";

export interface Classification {
  status: Status;
  /** Why this status was assigned. */
  basis: string;
  uncertainties: string[];
}

export function normalizeUnit(u: string): string {
  return u
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/μ/g, "µ")
    .replace(/^u/, "µ")
    .replace(/mcg/g, "µg");
}

/**
 * Deterministic comparison against the lab's own printed range.
 * Never invents ranges. "Within" only means "inside the printed range" — not "safe".
 */
export function classify(r: LabResult): Classification {
  const uncertainties: string[] = [];
  if (r.needsReview) uncertainties.push("This row was not fully readable and has not been confirmed.");

  const hasRange = r.rangeLow !== null || r.rangeHigh !== null;
  const flagStatus: Status | null =
    r.flag === "H" || r.flag === "HH" ? "above" : r.flag === "L" || r.flag === "LL" ? "below" : null;
  if (r.flag === "A") uncertainties.push("The lab marked this result as abnormal without saying high or low.");

  if (r.value === null) {
    if (flagStatus) return { status: flagStatus, basis: "Based only on the lab's flag (result is not a number).", uncertainties };
    uncertainties.push("The result is not a number, so it can't be compared to a numeric range.");
    return { status: "unknown", basis: "No numeric comparison possible.", uncertainties };
  }

  if (!hasRange) {
    uncertainties.push("The report does not show a reference range for this test.");
    if (flagStatus) return { status: flagStatus, basis: "Based only on the lab's flag.", uncertainties };
    return { status: "unknown", basis: "No reference range on the report.", uncertainties };
  }

  if (r.rangeUnit && r.unit && normalizeUnit(r.rangeUnit) !== normalizeUnit(r.unit)) {
    uncertainties.push(`The result unit (${r.unit}) differs from the range unit (${r.rangeUnit}).`);
    return { status: "unknown", basis: "Units don't match; no conversion is attempted.", uncertainties };
  }
  if (!r.unit) uncertainties.push("No unit was found for this result.");

  const lo = r.rangeLow;
  const hi = r.rangeHigh;
  const v = r.value;
  let status: Status = "unknown";

  if (r.comparator === "<" || r.comparator === "<=") {
    // True value is at or below v.
    if (lo !== null && v <= lo) status = "below";
    else if (lo === null && hi !== null && v <= hi) status = "within";
    else uncertainties.push("The result is reported as a bound (e.g. \"<5\"), so its exact position is unclear.");
  } else if (r.comparator === ">" || r.comparator === ">=") {
    if (hi !== null && v >= hi) status = "above";
    else if (hi === null && lo !== null && v >= lo) status = "within";
    else uncertainties.push("The result is reported as a bound (e.g. \">90\"), so its exact position is unclear.");
  } else {
    if (lo !== null && v < lo) status = "below";
    else if (hi !== null && v > hi) status = "above";
    else status = "within";
  }

  if (flagStatus && status !== "unknown" && flagStatus !== status) {
    uncertainties.push("The lab's own flag disagrees with the printed range. Please check the original report.");
  }
  return { status, basis: "Compared with the reference range printed on your report.", uncertainties };
}

/** Position of value within a padded scale for the range bar, 0..1. */
export function rangePosition(r: LabResult): { lo: number; hi: number; v: number } | null {
  if (r.value === null || r.rangeLow === null || r.rangeHigh === null || r.rangeHigh <= r.rangeLow) return null;
  const span = r.rangeHigh - r.rangeLow;
  const min = r.rangeLow - span * 0.5;
  const max = r.rangeHigh + span * 0.5;
  const clamp = (x: number) => Math.min(1, Math.max(0, (x - min) / (max - min)));
  return { lo: clamp(r.rangeLow), hi: clamp(r.rangeHigh), v: clamp(r.value) };
}

export const STATUS_LABEL: Record<Status, string> = {
  below: "Below Range",
  within: "Within Range",
  above: "Above Range",
  unknown: "Unknown",
};
