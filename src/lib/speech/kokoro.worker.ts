/// <reference lib="webworker" />
import { installFetchGuard } from "@/lib/ai/model/netguard";
import { progressReporter } from "./worker-client";

installFetchGuard(self as unknown as { fetch: typeof fetch; location: { origin: string } });

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tts: any = null;

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.type === "load") {
      // The self-contained web build avoids bundler issues with its embedded eSpeak data.
      const { KokoroTTS } = (await import(/* @vite-ignore */ "../../../node_modules/kokoro-js/dist/kokoro.web.js")) as typeof import("kokoro-js");
      const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      const webgpu = !!(gpu && (await gpu.requestAdapter().catch(() => null)));
      tts = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: webgpu ? "fp32" : "q8",
        device: webgpu ? "webgpu" : "wasm",
        progress_callback: progressReporter(post, "Downloading voice") as never,
      });
      post({ type: "progress", label: `Voice ready (${webgpu ? "WebGPU" : "CPU"})`, pct: 100 });
      post({ type: "loaded" });
    } else if (m.type === "run") {
      if (!tts) throw new Error("Voice not loaded");
      const audio = await tts.generate(m.text, { voice: "af_heart", speed: 1 });
      post({ type: "result", id: m.id, value: audio.toBlob() });
    }
  } catch (err) {
    post({ type: "error", id: m.id, message: err instanceof Error ? err.message : String(err) });
  }
};
