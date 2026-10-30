import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { linesOf, SAMPLE_TEXT } from "./sample";
import { parseLines } from "./parser";
import { getReport, listReports, loadChat, saveChat, saveReport, storageCounts, wipeAllLocalData } from "./storage";

const report = () => ({ id: "r1", title: "Synthetic", reportDate: "2026-03-14", fileName: "x.pdf", createdAt: 1, results: parseLines(linesOf(SAMPLE_TEXT)).results, limitations: [] });

describe("local storage", () => {
  it("stores reports encrypted and reads exact values back", async () => {
    await saveReport(report());
    const back = await getReport("r1");
    expect(back?.results.find((r) => r.name === "Hemoglobin")?.valueRaw).toBe("11.2");
  });
  it("Delete All removes reports and chats", async () => {
    await saveReport(report());
    await saveChat("r1", [{ q: "hi" }]);
    expect((await storageCounts()).reports).toBeGreaterThan(0);
    await wipeAllLocalData();
    expect(await storageCounts()).toEqual({ reports: 0, chats: 0 });
    expect(await listReports()).toEqual([]);
    expect(await loadChat("r1")).toEqual([]);
  });
});
