import type { ChatMessage } from "../prompt";
import { detectWebGPU } from "./support";
import type { LoadProgress, LocalModelAdapter } from "./types";

const MODEL_ID = "onnx-community/gemma-4-E2B-it-ONNX";

/** Gemma 4 E2B (4-bit, q4f16) via Transformers.js on WebGPU, inside a Web Worker. */
export function createGemmaAdapter(): LocalModelAdapter {
  let worker: Worker | null = null;
  let loaded = false;
  let nextId = 1;
  const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void; onToken?: ((t: string) => void) | undefined }>();

  const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL("./gemma.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (e) => {
      const m = e.data;
      if (m.type === "token") pending.get(m.id)?.onToken?.(m.text);
      if (m.type === "done") { pending.get(m.id)?.resolve(m.text); pending.delete(m.id); }
      if (m.type === "error" && m.id !== undefined) { pending.get(m.id)?.reject(new Error(m.message)); pending.delete(m.id); }
    });
    return worker;
  };

  return {
    id: "gemma-4-e2b-q4f16",
    label: "Gemma 4 E2B (on-device)",
    downloadSize: "about 3 GB, one-time",
    checkSupport: () => detectWebGPU(1024),
    isLoaded: () => loaded,
    load(onProgress: (p: LoadProgress) => void) {
      const w = ensureWorker();
      return new Promise<void>((resolve, reject) => {
        const h = (e: MessageEvent) => {
          const m = e.data;
          if (m.type === "progress") onProgress({ label: m.label, pct: m.pct });
          if (m.type === "loaded") { loaded = true; w.removeEventListener("message", h); resolve(); }
          if (m.type === "error" && m.id === undefined) { w.removeEventListener("message", h); reject(new Error(m.message)); }
        };
        w.addEventListener("message", h);
        w.postMessage({ type: "load", modelId: MODEL_ID, dtype: "q4f16" });
      });
    },
    generate(messages: ChatMessage[], onToken?: (t: string) => void) {
      if (!loaded) return Promise.reject(new Error("Model not loaded"));
      const id = nextId++;
      return new Promise<string>((resolve, reject) => {
        pending.set(id, { resolve, reject, onToken });
        ensureWorker().postMessage({ type: "generate", id, messages, maxNewTokens: 220 });
      });
    },
  };
}
