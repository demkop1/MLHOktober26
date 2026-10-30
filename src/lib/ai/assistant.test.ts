import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLines } from "@/lib/lab/parser";
import { sampleLines } from "@/lib/lab/sample";
import type { LabReport } from "@/lib/lab/types";
import { buildGroundedAnswer } from "./answer";
import { answerQuestion } from "./assistant";
import { KNOWLEDGE } from "./knowledge";
import { isAllowedModelRequest } from "./model/netguard";
import { validateModelText } from "./validate";

function sampleReport(id = "r1", date = "2026-03-14", tweak?: (r: LabReport) => void): LabReport {
  const { results } = parseLines(sampleLines());
  const r: LabReport = { id, title: "Sample", reportDate: date, fileName: "s.pdf", createdAt: 1, results, limitations: [] };
  tweak?.(r);
  return r;
}

afterEach(() => vi.restoreAllMocks());

describe("knowledge base", () => {
  it("has 15–20 entries, each with sources and licenses", () => {
    expect(KNOWLEDGE.length).toBeGreaterThanOrEqual(15);
    expect(KNOWLEDGE.length).toBeLessThanOrEqual(21);
    for (const e of KNOWLEDGE) {
      expect(e.sources.length).toBeGreaterThan(0);
      for (const s of e.sources) { expect(s.url).toMatch(/^https:\/\//); expect(s.license).toBeTruthy(); }
      expect(e.doctorQuestions.length).toBeGreaterThan(0);
    }
  });
});

describe("grounded answers", () => {
  it("never alters numerical values from the report", () => {
    const report = sampleReport();
    const a = buildGroundedAnswer("Can you explain my hemoglobin?", report);
    expect(a.intent).toBe("explain");
    expect(a.yourResult).toHaveLength(1);
    expect(a.yourResult[0]!.observation.valueRaw).toBe("11.2");
    expect(a.yourResult[0]!.text).toContain("11.2 g/dL");
    expect(a.yourResult[0]!.text).toContain("12.0 - 15.5");
    expect(a.summary).toContain("11.2");
  });

  it("missing range gives Unknown, not an invented classification", () => {
    const a = buildGroundedAnswer("Explain my creatinine", sampleReport());
    expect(a.yourResult[0]!.observation.status).toBe("unknown");
    expect(a.yourResult[0]!.text).toContain("no range on report");
  });

  it("every patient-specific fact has a report source", () => {
    const report = sampleReport();
    for (const q of ["Explain my cholesterol", "Which results are outside the lab's range?", "What should I ask my doctor?"]) {
      const a = buildGroundedAnswer(q, report);
      expect(a.yourResult.length).toBeGreaterThan(0);
      for (const f of a.yourResult) {
        expect(f.observation.reportId).toBe("r1");
        expect(f.source).toContain("page 1");
      }
    }
  });

  it("lists exactly the out-of-range results", () => {
    const a = buildGroundedAnswer("Which results are outside the lab's range?", sampleReport());
    expect(a.yourResult.map((f) => f.observation.testName).sort()).toEqual(
      ["Hemoglobin", "LDL Cholesterol", "Platelets", "Vitamin D"].sort(),
    );
  });

  it("unsupported questions get an honest 'I don't know'", () => {
    const a = buildGroundedAnswer("What's the weather in Vienna?", sampleReport());
    expect(a.intent).toBe("unsupported");
    expect(a.yourResult).toHaveLength(0);
    expect(a.summary).toMatch(/don't know/i);
  });

  it("refuses diagnosis requests", () => {
    const a = buildGroundedAnswer("Do I have diabetes?", sampleReport());
    expect(a.intent).toBe("refuse");
    expect(a.summary).toMatch(/can't diagnose/i);
  });

  it("compares with a previous report using exact values", () => {
    const prev = sampleReport("r0", "2025-09-01", (r) => {
      r.results = r.results.map((x) => (x.name === "Hemoglobin" ? { ...x, valueRaw: "12.4", value: 12.4 } : x));
    });
    const a = buildGroundedAnswer("How does my hemoglobin compare with my previous report?", sampleReport(), [prev, sampleReport()]);
    expect(a.intent).toBe("compare");
    expect(a.yourResult.map((f) => f.observation.valueRaw)).toEqual(["11.2", "12.4"]);
  });
});

describe("model layer", () => {
  it("no model → explicit fallback", async () => {
    const a = await answerQuestion("Explain my hemoglobin", sampleReport(), [], null);
    expect(a.generatedBy).toBe("library");
    expect(a.modelNote).toMatch(/AI is off/);
  });

  it("model failure → explicit fallback", async () => {
    const model = { label: "Stub", generate: vi.fn().mockRejectedValue(new Error("GPU lost")) };
    const a = await answerQuestion("Explain my hemoglobin", sampleReport(), [], model);
    expect(a.generatedBy).toBe("library");
    expect(a.modelNote).toMatch(/failed/);
  });

  it("rejects model text with invented numbers or diagnoses", async () => {
    const report = sampleReport();
    const base = buildGroundedAnswer("Explain my hemoglobin", report);
    expect(validateModelText("Your hemoglobin of 9.8 is low.", base).ok).toBe(false);
    expect(validateModelText("You have anemia.", base).ok).toBe(false);
    expect(validateModelText("Your hemoglobin is 11.2 g/dL, a bit under the lab's range of 12.0 to 15.5.", base).ok).toBe(true);

    const bad = { label: "Stub", generate: vi.fn().mockResolvedValue("Your value 13.0 means you have anemia.") };
    const a = await answerQuestion("Explain my hemoglobin", report, [], bad);
    expect(a.generatedBy).toBe("library");
    expect(a.yourResult[0]!.observation.valueRaw).toBe("11.2");
  });

  it("does not send patient data over the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const model = { label: "Stub", generate: vi.fn().mockResolvedValue("Hemoglobin carries oxygen in your blood.") };
    const a = await answerQuestion("Explain my hemoglobin", sampleReport(), [], model);
    expect(a.generatedBy).toBe("model");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("model worker may only download from model hosts, with GET and no body", () => {
    expect(isAllowedModelRequest("https://huggingface.co/onnx-community/x/resolve/main/a.onnx")).toBe(true);
    expect(isAllowedModelRequest("https://cas-bridge.xethub.hf.co/x")).toBe(true);
    expect(isAllowedModelRequest("https://api.example.com/log")).toBe(false);
    expect(isAllowedModelRequest("https://huggingface.co/x", { method: "POST", body: "hemoglobin 11.2" })).toBe(false);
    expect(isAllowedModelRequest("http://huggingface.co/x")).toBe(false);
  });
});
