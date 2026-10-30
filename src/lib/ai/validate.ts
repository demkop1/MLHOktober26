import type { Answer } from "./answer";

const BANNED: [RegExp, string][] = [
  [/\byou (have|likely have|probably have|may have|might have|are suffering)\b/i, "suggests a diagnosis"],
  [/\b(diagnos(is|ed|e)|disease|disorder|syndrome)\b/i, "uses diagnostic language"],
  [/\b(you should|you need to|you must) (take|start|stop|increase|decrease)\b/i, "gives treatment advice"],
  [/\b(prescri|dosage|\d+\s?(mg|mcg|iu)\b)/i, "mentions medicines or doses"],
  [/\b(nothing to worry|perfectly (healthy|normal|safe)|definitely|guarantee)\b/i, "claims unsupported certainty"],
];

/** All numbers that appear anywhere in the facts the model was given. */
function allowedNumbers(a: Answer): Set<string> {
  const s = new Set<string>();
  const text = a.yourResult.map((f) => f.text).join(" ") + " " + a.summary;
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) s.add(m[0].replace(",", "."));
  return s;
}

/**
 * Structured validation of model wording. The model may only rephrase; any number it writes must be
 * one that already appears in the report facts, and it must not diagnose, prescribe or over-reassure.
 */
export function validateModelText(text: string, a: Answer): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (!text.trim()) problems.push("was empty");
  const allowed = allowedNumbers(a);
  const bad = [...text.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(",", ".")).filter((n) => !allowed.has(n));
  if (bad.length) problems.push(`contained numbers not on your report (${[...new Set(bad)].join(", ")})`);
  for (const [re, why] of BANNED) if (re.test(text)) problems.push(why);
  return { ok: problems.length === 0, problems };
}
