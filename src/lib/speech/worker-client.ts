import type { SpeechProgress } from "./types";

/** Tiny request/response wrapper around a model Web Worker. */
export function createWorkerClient(make: () => Worker) {
  let worker: Worker | null = null;
  let loaded = false;
  let seq = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let onProgress: ((p: SpeechProgress) => void) | null = null;
  let loadWaiter: { resolve: () => void; reject: (e: Error) => void } | null = null;

  const get = () => {
    if (worker) return worker;
    worker = make();
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "progress") onProgress?.({ label: m.label, pct: m.pct });
      else if (m.type === "loaded") { loaded = true; loadWaiter?.resolve(); loadWaiter = null; }
      else if (m.type === "result") { pending.get(m.id)?.resolve(m.value); pending.delete(m.id); }
      else if (m.type === "error") {
        const err = new Error(m.message);
        if (m.id !== undefined) { pending.get(m.id)?.reject(err); pending.delete(m.id); }
        else { loadWaiter?.reject(err); loadWaiter = null; }
      }
    };
    worker.onerror = (e) => { loadWaiter?.reject(new Error(e.message || "Worker failed")); loadWaiter = null; };
    return worker;
  };

  return {
    isLoaded: () => loaded,
    load(cb: (p: SpeechProgress) => void) {
      if (loaded) return Promise.resolve();
      onProgress = cb;
      return new Promise<void>((resolve, reject) => {
        loadWaiter = { resolve, reject };
        get().postMessage({ type: "load" });
      });
    },
    call<T>(payload: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
      const id = seq++;
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        get().postMessage({ type: "run", id, ...payload }, transfer);
      });
    },
  };
}

/** Shared progress reporter for Transformers.js-style callbacks. */
export function progressReporter(post: (m: unknown) => void, label: string) {
  const files = new Map<string, { loaded: number; total: number }>();
  return (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status === "progress" && p.file && p.total) {
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
      const t = [...files.values()].reduce((a, f) => ({ l: a.l + f.loaded, t: a.t + f.total }), { l: 0, t: 0 });
      post({ type: "progress", label: `${label} (${Math.round(t.l / 1e6)} MB)`, pct: Math.round((t.l / t.t) * 100) });
    }
  };
}

export async function hasWebGPU() {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  return !!(await gpu.requestAdapter().catch(() => null));
}
