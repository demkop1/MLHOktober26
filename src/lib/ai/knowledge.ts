import kb from "./knowledge.json";

export interface KnowledgeSource {
  title: string;
  publisher: string;
  url: string;
  license: string;
}
export interface KnowledgeEntry {
  id: string;
  title: string;
  loinc: string | null;
  aliases: string[];
  measures: string;
  whyVaries: string[];
  limitations: string[];
  doctorQuestions: string[];
  sources: KnowledgeSource[];
}

export const KNOWLEDGE: KnowledgeEntry[] = kb.entries as KnowledgeEntry[];
export const KNOWLEDGE_LICENSE: string = kb.license;

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);

/** Does `text` mention `alias`? Short aliases (≤3 chars, e.g. "na", "k", "hb") need an exact word. */
export function mentions(text: string, alias: string): boolean {
  const t = text.toLowerCase();
  if (alias.length <= 3) return words(t).includes(alias);
  return new RegExp(`(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t);
}

/** Best entry for a lab test name. Longer (more specific) alias wins, so "LDL Cholesterol" → LDL, not total. */
export function findKnowledgeForTest(name: string): KnowledgeEntry | null {
  let best: { e: KnowledgeEntry; len: number } | null = null;
  for (const e of KNOWLEDGE)
    for (const a of e.aliases)
      if (mentions(name, a)) {
        const len = e.id === "cholesterol-total" && a === "cholesterol" ? 1 : a.length + 10;
        if (!best || len > best.len) best = { e, len };
      }
  return best?.e ?? null;
}

/** Keyword retrieval over the knowledge base for free-text questions. */
export function searchKnowledge(question: string, limit = 3): KnowledgeEntry[] {
  const direct = KNOWLEDGE.filter((e) => e.aliases.some((a) => mentions(question, a)));
  // Prefer specific matches: drop total cholesterol if LDL/HDL is also named, unless "total" is asked.
  const specific = direct.filter(
    (e) => !(e.id === "cholesterol-total" && !/total/i.test(question) && direct.some((d) => d.id === "ldl" || d.id === "hdl")),
  );
  if (specific.length) return specific.slice(0, limit);

  const q = new Set(words(question).filter((w) => w.length > 3));
  if (q.size === 0) return [];
  return KNOWLEDGE.map((e) => ({ e, score: words(`${e.title} ${e.measures}`).filter((w) => q.has(w)).length }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}
