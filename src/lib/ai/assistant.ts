import type { LabReport } from "@/lib/lab/types";
import { buildGroundedAnswer, type Answer } from "./answer";
import type { TextGenerator } from "./model/types";
import { buildPrompt } from "./prompt";
import { validateModelText } from "./validate";

/** Intents where model rewording adds value; others are answered directly from structured data. */
const MODEL_INTENTS = new Set(["explain", "general", "out_of_range"]);

/**
 * Answer a question. Facts always come from structured report data. If a local model is available it
 * may rewrite "What it means"; its text is validated and discarded if it breaks the rules.
 */
export async function answerQuestion(
  question: string,
  report: LabReport,
  allReports: LabReport[],
  model: TextGenerator | null,
  onToken?: (t: string) => void,
): Promise<Answer> {
  const a = buildGroundedAnswer(question, report, allReports);
  if (!model) {
    return { ...a, modelNote: "On-device AI is off, so this answer comes straight from your report and the reference library." };
  }
  if (!MODEL_INTENTS.has(a.intent) || (a.yourResult.length === 0 && a.meaning.length === 0 && a.intent !== "general")) {
    return a;
  }
  try {
    const text = await model.generate(buildPrompt(question, a), onToken);
    const v = validateModelText(text, a);
    if (!v.ok) {
      return { ...a, modelNote: `The AI's wording was not used because it ${v.problems.join(" and ")}. Showing the library explanation instead.` };
    }
    return { ...a, meaning: [text.trim()], generatedBy: "model", modelNote: `Explanation worded by ${model.label}, checked against your report.` };
  } catch (e) {
    return { ...a, modelNote: `On-device AI failed (${e instanceof Error ? e.message : "unknown error"}), so this is the library explanation.` };
  }
}
