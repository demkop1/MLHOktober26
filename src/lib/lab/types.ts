export type Comparator = "<" | "<=" | ">" | ">=" | null;
export type LabFlag = "H" | "L" | "HH" | "LL" | "A" | null;
export type Status = "below" | "within" | "above" | "unknown";

export interface LabResult {
  id: string;
  name: string;
  /** Exactly what the report printed for the value. */
  valueRaw: string;
  value: number | null;
  comparator: Comparator;
  unit: string;
  rangeRaw: string;
  rangeLow: number | null;
  rangeHigh: number | null;
  /** Unit the range applies to; empty means "same row as the value". */
  rangeUnit: string;
  flag: LabFlag;
  /** True only when the lab itself marked the result critical/panic (or HH/LL). */
  critical?: boolean;
  /** 1-based source page; null for manually added rows. */
  page: number | null;
  /** OCR confidence 0-100 when applicable. */
  confidence: number | null;
  needsReview: boolean;
  sourceLine: string;
}

export interface LabReport {
  id: string;
  title: string;
  reportDate: string | null;
  fileName: string;
  createdAt: number;
  results: LabResult[];
  limitations: string[];
}

export interface ExtractedLine {
  text: string;
  page: number;
  confidence: number | null;
}
