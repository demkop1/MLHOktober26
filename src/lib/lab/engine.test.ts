import { describe, expect, it } from "vitest";
import { classify } from "./engine";
import { parseLines, parseRange } from "./parser";
import { sampleLines } from "./sample";
import type { LabResult } from "./types";

const base: LabResult = {
  id: "x", name: "Test", valueRaw: "", value: 5, comparator: null, unit: "mg/dL", rangeRaw: "",
  rangeLow: 2, rangeHigh: 8, rangeUnit: "", flag: null, page: 1, confidence: null, needsReview: false, sourceLine: "",
};

describe("comparison engine", () => {
  it("below / within / above", () => {
    expect(classify({ ...base, value: 1 }).status).toBe("below");
    expect(classify({ ...base, value: 5 }).status).toBe("within");
    expect(classify({ ...base, value: 9 }).status).toBe("above");
  });
  it("missing range without flag is unknown (no invented ranges)", () => {
    expect(classify({ ...base, rangeLow: null, rangeHigh: null }).status).toBe("unknown");
  });
  it("missing range with lab flag uses the flag", () => {
    expect(classify({ ...base, rangeLow: null, rangeHigh: null, flag: "H" }).status).toBe("above");
  });
  it("unit mismatch is unknown", () => {
    expect(classify({ ...base, rangeUnit: "mmol/L" }).status).toBe("unknown");
  });
  it("non-numeric is unknown", () => {
    expect(classify({ ...base, value: null, valueRaw: "Negative" }).status).toBe("unknown");
  });
  it("'<0.5' with range '<5' is within", () => {
    expect(classify({ ...base, value: 0.5, comparator: "<", rangeLow: null, rangeHigh: 5 }).status).toBe("within");
  });
  it("'<5' against range 2-8 is unknown", () => {
    expect(classify({ ...base, value: 5, comparator: "<" }).status).toBe("unknown");
  });
});

describe("parser", () => {
  it("parses ranges", () => {
    expect(parseRange("12.0 - 15.5")).toEqual({ low: 12, high: 15.5 });
    expect(parseRange("< 130")).toEqual({ low: null, high: 130 });
    expect(parseRange("> 40")).toEqual({ low: 40, high: null });
  });
  it("parses the synthetic sample", () => {
    const { results, reportDate } = parseLines(sampleLines());
    expect(reportDate).toBe("2026-03-14");
    const by = (n: string) => results.find((r) => r.name.startsWith(n))!;
    expect(by("Hemoglobin")).toMatchObject({ value: 11.2, unit: "g/dL", rangeLow: 12, rangeHigh: 15.5, flag: "L" });
    expect(by("Platelets")).toMatchObject({ value: 412, unit: "10^3/uL", flag: "H" });
    expect(by("Creatinine")).toMatchObject({ value: 0.9, rangeLow: null, rangeHigh: null });
    expect(by("CRP")).toMatchObject({ comparator: "<", value: 0.5, rangeHigh: 5 });
    expect(by("Hepatitis")).toMatchObject({ value: null, valueRaw: "Negative" });
    expect(results).toHaveLength(12);
  });
});
