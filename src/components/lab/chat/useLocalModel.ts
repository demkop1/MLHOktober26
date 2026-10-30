import { useCallback, useEffect, useState } from "react";
import type { LoadProgress, LocalModelAdapter, SupportReport } from "@/lib/ai/model/types";

export type ModelState =
  | { phase: "checking" }
  | { phase: "unsupported"; support: SupportReport }
  | { phase: "idle"; support: SupportReport }
  | { phase: "loading"; progress: LoadProgress }
  | { phase: "ready" }
  | { phase: "error"; message: string };

// One adapter per page session so the model stays loaded across reports.
let adapterPromise: Promise<LocalModelAdapter> | null = null;
const getAdapter = () => (adapterPromise ??= import("@/lib/ai/model/gemma").then((m) => m.createGemmaAdapter()));

export function useLocalModel() {
  const [state, setState] = useState<ModelState>({ phase: "checking" });
  const [adapter, setAdapter] = useState<LocalModelAdapter | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdapter().then(async (a) => {
      if (cancelled) return;
      setAdapter(a);
      if (a.isLoaded()) return setState({ phase: "ready" });
      const support = await a.checkSupport();
      if (!cancelled) setState(support.supported ? { phase: "idle", support } : { phase: "unsupported", support });
    });
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (!adapter) return;
    setState({ phase: "loading", progress: { label: "Starting…", pct: 0 } });
    try {
      await adapter.load((progress) => setState({ phase: "loading", progress }));
      setState({ phase: "ready" });
    } catch (e) {
      setState({ phase: "error", message: e instanceof Error ? e.message : "Could not load the model." });
    }
  }, [adapter]);

  return { state, adapter, ready: state.phase === "ready" && !!adapter, load };
}
