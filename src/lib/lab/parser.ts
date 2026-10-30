import type { Comparator, ExtractedLine, LabFlag, LabResult } from "./types";

const NUM = String.raw`-?\d+(?:[.,]\d+)?`;
const UNIT = String.raw`(?:10\^\d+\/)?[A-Za-zµμ%][A-Za-z0-9µμ%\/\.\^]*`;
const FLAG = String.raw`\*?(?:HH|LL|H|L|High|Low|A|Abnormal)\b\*?`;
const RANGE = String.raw`(?:[<>≤≥]=?\s*${NUM}|${NUM}\s*[-–—]\s*${NUM}|${NUM}\s*(?:to)\s*${NUM})`;

const LINE_RE = new RegExp(
  String.raw`^([A-Za-z][A-Za-z0-9 ,()\/\-\.']*?[A-Za-z0-9)])\s*[:\s]\s*` +
    String.raw`([<>≤≥]=?)?\s*(${NUM})\s*` +
    String.raw`(${FLAG})?\s*` +
    String.raw`(${UNIT})?\s*` +
    String.raw`(${FLAG})?\s*` +
    String.raw`\(?\s*(${RANGE})?\s*\)?\s*` +
    String.raw`(${UNIT})?\s*` +
    String.raw`(${FLAG})?\s*$`,
  "i",
);

const QUAL_RE = /^([A-Za-z][A-Za-z0-9 ,()/\-.']*?)\s*[:\s]\s*(positive|negative|reactive|non-reactive|detected|not detected|trace|normal|abnormal)\b\s*(.*)$/i;

const SKIP = /^(page|patient|name|dob|date|test|result|reference|units?|lab|specimen|collected|reported|physician|doctor|sex|age|id|mrn|address|phone)\b/i;

export const toNum = (s: string | undefined) => {
  if (s === undefined) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function parseFlag(s?: string | null): LabFlag {
  if (!s) return null;
  const f = s.replace(/\*/g, "").toUpperCase();
  if (f === "HIGH") return "H";
  if (f === "LOW") return "L";
  if (f === "ABNORMAL") return "A";
  if (["H", "L", "HH", "LL", "A"].includes(f)) return f as LabFlag;
  return null;
}

export function parseRange(s: string): { low: number | null; high: number | null } {
  const t = s.trim().replace(/≤/g, "<=").replace(/≥/g, ">=");
  let m = t.match(new RegExp(String.raw`^(${NUM})\s*(?:[-–—]|to)\s*(${NUM})$`, "i"));
  if (m) return { low: toNum(m[1]), high: toNum(m[2]) };
  m = t.match(new RegExp(String.raw`^<=?\s*(${NUM})$`));
  if (m) return { low: null, high: toNum(m[1]) };
  m = t.match(new RegExp(String.raw`^>=?\s*(${NUM})$`));
  if (m) return { low: toNum(m[1]), high: null };
  return { low: null, high: null };
}

const CRITICAL_RE = /\(?\b(critical|panic)\b\)?|!!/gi;
/** Only the lab's own wording counts as critical; the app never decides this itself. */
export const hasCriticalMarker = (s: string) => /\b(critical|panic)\b|!!/i.test(s);

let counter = 0;
export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `r${Date.now()}${counter++}`;

export function parseLine(line: ExtractedLine): LabResult | null {
  const original = line.text.replace(/\s+/g, " ").trim();
  if (original.length < 3 || SKIP.test(original)) return null;
  const lowConf = line.confidence !== null && line.confidence < 75;
  const marked = hasCriticalMarker(original);
  // Strip lab "critical" markers so the row still parses; the marker is kept as a separate fact.
  const text = marked ? original.replace(CRITICAL_RE, " ").replace(/\s+/g, " ").trim() : original;

  const m = text.match(LINE_RE);
  if (m) {
    const [, name, cmp, val, f1, unit1, f2, range, unit2, f3] = m;
    const r = range ? parseRange(range) : { low: null, high: null };
    const comparator = (cmp ? cmp.replace("≤", "<=").replace("≥", ">=") : null) as Comparator;
    return {
      id: newId(),
      name: (name ?? "").trim(),
      valueRaw: `${cmp ?? ""}${val}`,
      value: toNum(val),
      comparator,
      unit: unit1 ?? unit2 ?? "",
      rangeRaw: range ?? "",
      rangeLow: r.low,
      rangeHigh: r.high,
      rangeUnit: "",
      flag: parseFlag(f1 ?? f2 ?? f3),
      critical: marked || /\b(HH|LL)\b/.test(`${f1 ?? ""} ${f2 ?? ""} ${f3 ?? ""}`),
      page: line.page,
      confidence: line.confidence,
      needsReview: lowConf,
      sourceLine: original,
    };
  }
  const q = text.match(QUAL_RE);
  if (q && q[1] && !SKIP.test(q[1])) {
    return {
      id: newId(),
      name: q[1].trim(),
      valueRaw: q[2] ?? "",
      value: null,
      comparator: null,
      unit: "",
      rangeRaw: (q[3] ?? "").trim(),
      rangeLow: null,
      rangeHigh: null,
      rangeUnit: "",
      flag: null,
      critical: marked,
      page: line.page,
      confidence: line.confidence,
      needsReview: lowConf,
      sourceLine: original,
    };
  }
  return null;
}

/** Lines that look like a result (name + digits) but couldn't be parsed. */
export function looksLikeResult(text: string) {
  return /[A-Za-z]{3,}.*\d/.test(text) && !SKIP.test(text.trim());
}

export function findDate(lines: ExtractedLine[]): string | null {
  for (const l of lines) {
    const m = l.text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/);
    if (m && /date|collected|reported/i.test(l.text)) return m[1] ?? null;
  }
  for (const l of lines) {
    const m = l.text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (m) return m[1] ?? null;
  }
  return null;
}

export function parseLines(lines: ExtractedLine[]) {
  const results: LabResult[] = [];
  const unparsed: ExtractedLine[] = [];
  for (const l of lines) {
    const r = parseLine(l);
    if (r) results.push(r);
    else if (looksLikeResult(l.text)) unparsed.push(l);
  }
  return { results, unparsed, reportDate: findDate(lines) };
}
