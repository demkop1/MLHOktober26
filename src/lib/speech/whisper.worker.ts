/// <reference lib="webworker" />
import { installFetchGuard } from "@/lib/ai/model/netguard";
import { progressReporter } from "./worker-client";

installFetchGuard(self as unknown as { fetch: typeof fetch; location: { origin: string } });

const MODEL_ID = "onnx-community/whisper-base";
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null;

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    if (m.type === "load") {
      const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      const webgpu = !!(gpu && (await gpu.requestAdapter().catch(() => null)));
      asr = await tf.pipeline("automatic-speech-recognition", MODEL_ID, {
        device: webgpu ? "webgpu" : "wasm",
        dtype: webgpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
        progress_callback: progressReporter(post, "Downloading speech recognition") as never,
      } as never);
      post({ type: "loaded" });
    } else if (m.type === "run") {
      if (!asr) throw new Error("Speech recognition not loaded");
      const out = await asr(m.audio, { language: "english", task: "transcribe" });
      post({ type: "result", id: m.id, value: String((Array.isArray(out) ? out[0] : out).text ?? "").trim() });
    }
  } catch (err) {
    post({ type: "error", id: m.id, message: err instanceof Error ? err.message : String(err) });
  }
};
