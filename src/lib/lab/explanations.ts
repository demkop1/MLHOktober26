import { findKnowledgeForTest } from "@/lib/ai/knowledge";

/** Short "what does this measure" text for result cards, from the curated knowledge base. */
export function explain(name: string): { title: string; what: string } | null {
  const e = findKnowledgeForTest(name);
  return e ? { title: e.title, what: e.measures } : null;
}
