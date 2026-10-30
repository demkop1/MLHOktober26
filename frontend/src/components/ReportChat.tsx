import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatWithReport, type ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Turn = ChatMessage & { sources?: string[] };

const SUGGESTIONS = ["Which of my results are outside the normal range?", "What should I ask my doctor?", "Explain my most important result."];

// `text` / `file` are the report that was analysed (pasted text, or a PDF data URL).
export function ReportChat({ text, file }: { text?: string | undefined; file?: string | undefined }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, loading]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const r = await chatWithReport({
        text,
        file,
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      setTurns([...next, { role: "assistant", content: r.answer, sources: r.sources }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <div className="flex flex-col items-start gap-3 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageCircle className="size-5 text-sage" /> Ask anything about your report. Answers come from its content.
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="rounded-full border bg-cream px-3 py-1.5 text-sm hover:border-sage">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {t.content}
              {t.sources && t.sources.length > 0 && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Parts of your report used</summary>
                  {t.sources.map((s, k) => (
                    <pre key={k} className="mt-1 whitespace-pre-wrap rounded-lg bg-cream p-2 font-mono">{s}</pre>
                  ))}
                </details>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-muted-foreground">Looking through your report…</div>}
        <div ref={endRef} />
      </div>
      {error && <p className="mt-3 rounded-lg bg-status-flag-soft px-3 py-2 text-sm text-status-flag">{error}</p>}
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          placeholder="Ask a question about your results…"
          className="min-h-12 resize-none rounded-xl bg-cream text-sm"
          rows={1}
        />
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-xl" disabled={!input.trim() || loading}>
          <Send />
        </Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">Not medical advice. Check anything important with your doctor.</p>
    </div>
  );
}
