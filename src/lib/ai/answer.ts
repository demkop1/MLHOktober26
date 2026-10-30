import type { LabReport } from "@/lib/lab/types";
import { searchKnowledge, findKnowledgeForTest, type KnowledgeEntry, type KnowledgeSource } from "./knowledge";
import { compareWithPrevious, factText, matchResults, toObservation, type Observation } from "./retrieval";

export type Intent = "explain" | "out_of_range" | "general" | "compare" | "doctor" | "refuse" | "unsupported";

export interface Fact {
  text: string;
  source: string;
  observation: Observation;
}

export interface Answer {
  intent: Intent;
  /** Short lead sentence shown by default. */
  summary: string;
  yourResult: Fact[];
  meaning: string[];
  known: string[];
  unknown: string[];
  doctorQuestions: string[];
  references: KnowledgeSource[];
  followUps: string[];
  generatedBy: "library" | "model";
  modelNote: string | null;
}

const REFUSE_RE = /\b(do i have|am i (sick|ill|dying)|diagnos|cancer|should i (take|stop|start)|what (medicine|medication|drug|dose)|dosage|prescri|treat(ment)?|cure)\b/i;
const OUT_RE = /\b(outside|out of range|abnormal|flagged|which .*(high|low)|any.*(high|low)|not normal)\b/i;
const COMPARE_RE = /\b(previous|last time|earlier|compare|changed?|trend|before|over time)\b/i;
const DOCTOR_RE = /\b(ask|doctor|clinician|physician|gp|appointment)\b/i;
const GENERAL_RE = /\b(what (does|is|are)|measure|mean|why)\b/i;

export function detectIntent(q: string, matchedTests: number, kbHits: number): Intent {
  if (REFUSE_RE.test(q)) return "refuse";
  if (COMPARE_RE.test(q)) return "compare";
  if (DOCTOR_RE.test(q)) return "doctor";
  if (OUT_RE.test(q) && matchedTests === 0) return "out_of_range";
  if (matchedTests > 0) return "explain";
  if (kbHits > 0 && GENERAL_RE.test(q)) return "general";
  if (kbHits > 0) return "general";
  if (/\b(summar|overview|all (my )?results)\b/i.test(q)) return "out_of_range";
  return "unsupported";
}

const toFact = (o: Observation): Fact => ({
  text: factText(o),
  source: [o.reportTitle, o.reportDate ?? "date unknown", o.page ? `page ${o.page}` : "added manually", o.verification].join(" · "),
  observation: o,
});

function uniq<T>(xs: T[], key: (x: T) => string = String) {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

function statusUncertainty(o: Observation): string[] {
  const out: string[] = [];
  if (o.verification === "unconfirmed") out.push(`${o.testName} was not confirmed during checking, so the value may have been misread.`);
  if (o.status === "unknown") out.push(`${o.testName} couldn't be compared with a range (${o.rangeRaw ? "see the card for why" : "the report shows no range"}).`);
  return out;
}

const GENERIC_LIMITS = [
  "Being inside or outside the printed range is not a diagnosis. Your clinician considers your history, symptoms and other tests.",
];

/**
 * Deterministic, source-grounded answer. This is both the fallback when no local model is available
 * and the factual frame the model may only rephrase.
 */
export function buildGroundedAnswer(question: string, report: LabReport, allReports: LabReport[] = []): Answer {
  const matched = matchResults(question, report);
  const kbFromQuestion = searchKnowledge(question);
  const intent = detectIntent(question, matched.length, kbFromQuestion.length);

  const base: Answer = {
    intent, summary: "", yourResult: [], meaning: [], known: [], unknown: [], doctorQuestions: [],
    references: [], followUps: [], generatedBy: "library", modelNote: null,
  };
  const kbFor = (obs: Observation[]) =>
    uniq(obs.map((o) => findKnowledgeForTest(o.testName)).filter((e): e is KnowledgeEntry => !!e), (e) => e.id);
  const withKb = (a: Answer, entries: KnowledgeEntry[], facts: Observation[]) => {
    a.meaning.push(...entries.map((e) => e.measures));
    a.known.push(...entries.flatMap((e) => e.whyVaries.slice(0, 2)));
    a.unknown.push(...facts.flatMap(statusUncertainty), ...entries.flatMap((e) => e.limitations.slice(0, 1)), ...GENERIC_LIMITS);
    a.doctorQuestions.push(...entries.flatMap((e) => e.doctorQuestions.slice(0, 2)));
    a.references = uniq(entries.flatMap((e) => e.sources), (s) => s.url);
    const unknownTests = facts.filter((o) => !findKnowledgeForTest(o.testName));
    if (unknownTests.length)
      a.unknown.push(`My reference library has no description for: ${unknownTests.map((o) => o.testName).join(", ")}.`);
    return a;
  };

  switch (intent) {
    case "refuse": {
      const obs = matched.map((r) => toObservation(r, report));
      return {
        ...base,
        summary: "I can't diagnose conditions or recommend treatments or medicines — that needs your clinician. I can show what your report says and explain what tests measure.",
        yourResult: obs.map(toFact),
        unknown: ["Whether a result means you have a condition depends on things this app can't see, like symptoms, history and examinations."],
        doctorQuestions: ["What do these results mean for me specifically?", "Do I need any further tests or follow-up?"],
        followUps: ["Which results are outside the lab's range?", "What should I ask my doctor?"],
      };
    }
    case "explain": {
      const obs = matched.map((r) => toObservation(r, report));
      const entries = kbFor(obs);
      const a = withKb({ ...base, yourResult: obs.map(toFact) }, entries, obs);
      a.summary = obs.length === 1
        ? `Your ${obs[0]!.testName} is ${obs[0]!.valueRaw}${obs[0]!.unit ? ` ${obs[0]!.unit}` : ""}, marked ${obs[0]!.statusLabel} compared with your lab's printed range.`
        : `I found ${obs.length} matching results on this report.`;
      a.followUps = ["How does this compare with my previous report?", "What should I ask my doctor?", "Which results are outside the lab's range?"];
      return a;
    }
    case "out_of_range": {
      const all = report.results.map((r) => toObservation(r, report));
      const outside = all.filter((o) => o.status === "above" || o.status === "below");
      const unknown = all.filter((o) => o.status === "unknown");
      const a = withKb({ ...base, yourResult: outside.map(toFact) }, kbFor(outside), outside);
      a.summary = outside.length
        ? `${outside.length} of ${all.length} results are outside the range printed by your lab${unknown.length ? `, and ${unknown.length} couldn't be compared` : ""}.`
        : `None of the ${all.length} results are outside the printed ranges${unknown.length ? `, but ${unknown.length} couldn't be compared` : ""}.`;
      if (unknown.length) a.unknown.unshift(`Couldn't be compared: ${unknown.map((o) => o.testName).join(", ")}.`);
      a.unknown.push("Being within a range doesn't guarantee everything is fine, and being slightly outside doesn't always mean something is wrong.");
      a.followUps = outside.slice(0, 2).map((o) => `Can you explain my ${o.testName}?`).concat("What should I ask my doctor?");
      return a;
    }
    case "compare": {
      const targets = matched.length ? matched : report.results;
      const comps = compareWithPrevious(report, targets, allReports);
      const withPrev = comps.filter((c) => c.previous);
      const a: Answer = { ...base, references: [] };
      for (const c of withPrev) {
        a.yourResult.push(toFact(c.current), toFact(c.previous!));
        a.known.push(`${c.current.testName}: ${c.note}`);
      }
      const missing = comps.filter((c) => !c.previous).map((c) => c.current.testName);
      if (missing.length) a.unknown.push(`No earlier value on this device for: ${missing.join(", ")}.`);
      a.unknown.push("Small changes between tests can come from normal day-to-day variation or differences between labs.");
      a.summary = withPrev.length
        ? `I found earlier values for ${withPrev.length} test${withPrev.length > 1 ? "s" : ""} on a previous report saved on this device.`
        : "I couldn't find an earlier report on this device with the same tests, so there's nothing to compare yet.";
      a.doctorQuestions.push("Are these changes meaningful for me, or within normal variation?");
      a.followUps = ["Which results are outside the lab's range?"];
      return a;
    }
    case "doctor": {
      const all = report.results.map((r) => toObservation(r, report));
      const focus = matched.length ? matched.map((r) => toObservation(r, report)) : all.filter((o) => o.status !== "within");
      const a = withKb({ ...base, yourResult: focus.map(toFact) }, kbFor(focus), focus);
      a.meaning = [];
      a.doctorQuestions.push("Do any of these results need follow-up or a repeat test?", "Do my other health details change how these results should be read?");
      a.doctorQuestions = uniq(a.doctorQuestions);
      a.summary = focus.length
        ? `Here are some questions you could bring, based on ${focus.length} result${focus.length > 1 ? "s" : ""} worth discussing.`
        : "All results are within the printed ranges. Here are some general questions you could still ask.";
      a.followUps = ["Which results are outside the lab's range?"];
      return a;
    }
    case "general": {
      const a = withKb({ ...base }, kbFromQuestion, []);
      const onReport = report.results.filter((r) => kbFromQuestion.some((e) => findKnowledgeForTest(r.name)?.id === e.id));
      a.summary = kbFromQuestion.map((e) => e.measures).join(" ");
      a.meaning = [];
      a.followUps = onReport.length ? [`Can you explain my ${onReport[0]!.name}?`] : ["Which results are outside the lab's range?"];
      if (!onReport.length) a.unknown.unshift("This test doesn't appear on the selected report, so this is general information only.");
      return a;
    }
    default:
      return {
        ...base,
        summary: "I don't know the answer to that from your report or my reference library. I can explain the tests on this report, list results outside the lab's range, compare with earlier reports, or suggest questions for your doctor.",
        unknown: ["Your question didn't match any test on this report or any topic in the reference library."],
        followUps: ["Which results are outside the lab's range?", "What should I ask my doctor?"],
      };
  }
}
