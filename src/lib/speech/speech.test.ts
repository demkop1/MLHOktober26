import { describe, expect, it } from "vitest";
import { buildGroundedAnswer } from "@/lib/ai/answer";
import { classify } from "@/lib/lab/engine";
import { decryptBackup, encryptBackup } from "@/lib/lab/backup";
import { linesOf, SAMPLE_BASELINE_TEXT, SAMPLE_CRITICAL_TEXT, sampleLines } from "@/lib/lab/sample";
import { parseLine, parseLines } from "@/lib/lab/parser";
import { trendFor } from "@/lib/lab/trends";
import type { LabReport } from "@/lib/lab/types";
import { cloudVoiceInput } from "./elevenlabs.functions";
import { answerNarration, inventedNumbers, MAX_NARRATION_CHARS, overviewCounts, overviewNarration, resultNarration } from "./narration";

const rep = (id: string, text: string, date: string): LabReport => {
  const p = parseLines(linesOf(text));
  return { id, title: id, reportDate: date, fileName: "", createdAt: Date.parse(date), results: p.results, limitations: [] };
};
const followup = () => rep("followup", sampleLines().map((l) => l.text).join("\n"), "2026-03-14");

describe("lab critical flags", () => {
  it("only come from the lab's own markers", () => {
    const r = rep("c", SAMPLE_CRITICAL_TEXT, "2026-04-02");
    const k = r.results.find((x) => x.name === "Potassium")!;
    expect(k).toMatchObject({ valueRaw: "6.4", flag: "HH", critical: true, rangeLow: 3.5, rangeHigh: 5.1 });
    // A far-out-of-range value without a lab marker is NOT critical.
    const na = r.results.find((x) => x.name === "Sodium")!;
    expect(na.critical).toBe(false);
    expect(parseLine({ text: "Glucose 400 mg/dL 70 - 99", page: 1, confidence: null })!.critical).toBe(false);
    expect(parseLine({ text: "Glucose 40 mg/dL 70 - 99 PANIC", page: 1, confidence: null })!.critical).toBe(true);
  });
});

describe("overview", () => {
  it("counts match the comparison engine", () => {
    const r = followup();
    const c = overviewCounts(r);
    for (const s of ["below", "within", "above", "unknown"] as const)
      expect(c[s]).toBe(r.results.filter((x) => classify(x).status === s).length);
    expect(c).toMatchObject({ above: 2, below: 2, unknown: 2, within: 6, total: 12, critical: 0 });
  });
  it("narration has no health score or reassurance", () => {
    const t = overviewNarration(followup());
    expect(t).not.toMatch(/score|healthy|nothing to worry|all good/i);
  });
});

describe("trends", () => {
  const base = rep("base", SAMPLE_BASELINE_TEXT, "2025-09-12");
  it("show for the same test and unit, in date order, with exact values", () => {
    const f = followup();
    const hb = f.results.find((x) => x.name === "Hemoglobin")!;
    const t = trendFor(hb, f, [f, base]);
    expect(t.reason).toBeNull();
    expect(t.points.map((p) => p.valueRaw)).toEqual(["12.6", "11.2"]);
  });
  it("are withheld when units differ", () => {
    const f = followup();
    const hb = { ...f.results.find((x) => x.name === "Hemoglobin")!, unit: "g/L" };
    expect(trendFor(hb, f, [f, base]).reason).toMatch(/different unit/);
  });
});

describe("narration", () => {
  it("never speaks numbers that aren't on the report", () => {
    const f = followup();
    for (const r of f.results) expect(inventedNumbers(resultNarration(r), `${r.name} ${r.valueRaw} ${r.unit} ${r.rangeRaw}`)).toEqual([]);
    const a = buildGroundedAnswer("Can you explain my hemoglobin?", f);
    expect(inventedNumbers(answerNarration(a), a.yourResult.map((x) => x.text).join(" "))).toEqual([]);
    expect(answerNarration(a)).toContain("11.2");
  });
  it("is short", () => {
    const a = buildGroundedAnswer("Which results are outside the lab's range?", followup());
    expect(answerNarration(a).length).toBeLessThanOrEqual(MAX_NARRATION_CHARS);
  });
});

describe("cloud voice input", () => {
  it("refuses without explicit consent", () => {
    expect(() => cloudVoiceInput.parse({ text: "Hello" })).toThrow();
    expect(() => cloudVoiceInput.parse({ text: "Hello", consent: false })).toThrow();
    expect(cloudVoiceInput.parse({ text: "Hello", consent: true }).text).toBe("Hello");
  });
  it("refuses long text (no full reports)", () => {
    expect(() => cloudVoiceInput.parse({ text: "x".repeat(MAX_NARRATION_CHARS + 1), consent: true })).toThrow();
  });
});

describe("encrypted backup", () => {
  it("round-trips and rejects a wrong passcode", async () => {
    const payload = { reports: [followup()] };
    const file = await encryptBackup(payload, "correct horse", 1000);
    expect(JSON.stringify(file)).not.toContain("Hemoglobin");
    expect(await decryptBackup(file, "correct horse")).toEqual(payload);
    await expect(decryptBackup(file, "wrong pass!")).rejects.toThrow(/Wrong passcode/);
  });
  it("requires an 8+ character passcode", async () => {
    await expect(encryptBackup({}, "short")).rejects.toThrow();
  });
});
