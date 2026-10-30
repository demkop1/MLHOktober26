/// <reference lib="webworker" />
import { installFetchGuard } from "./netguard";

// Must run before the runtime is imported so every download goes through the guard.
installFetchGuard(self as unknown as { fetch: typeof fetch; location: { origin: string } });

type In =
  | { type: "load"; modelId: string; dtype: string }
  | { type: "generate"; id: number; messages: { role: string; content: string }[]; maxNewTokens: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data;
  try {
    const tf = await import("@huggingface/transformers");
    tf.env.allowLocalModels = false;
    tf.env.useBrowserCache = true;
    if (msg.type === "load") {
      const files = new Map<string, { loaded: number; total: number }>();
      const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number; progress?: number }) => {
        if (p.status === "progress_total" && typeof p.progress === "number") {
          post({ type: "progress", label: "Downloading model", pct: Math.round(p.progress) });
        } else if (p.status === "progress" && p.file && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          const t = [...files.values()].reduce((a, f) => ({ l: a.l + f.loaded, t: a.t + f.total }), { l: 0, t: 0 });
          post({ type: "progress", label: `Downloading model (${(t.l / 1e9).toFixed(2)} GB)`, pct: Math.round((t.l / t.t) * 100) });
        }
      };
      processor = await tf.AutoProcessor.from_pretrained(msg.modelId, { progress_callback });
      model = await tf.Gemma4ForConditionalGeneration.from_pretrained(msg.modelId, {
        dtype: msg.dtype as "q4f16",
        device: "webgpu",
        progress_callback,
      });
      post({ type: "progress", label: "Preparing model on your GPU", pct: null });
      post({ type: "loaded" });
      return;
    }
    if (msg.type === "generate") {
      if (!model || !processor) throw new Error("Model not loaded");
      const messages = msg.messages.map((m) => ({ role: m.role, content: [{ type: "text", text: m.content }] }));
      const prompt = processor.apply_chat_template(messages, { enable_thinking: false, add_generation_prompt: true });
      const inputs = await processor(prompt, null, null, { add_special_tokens: false });
      const streamer = new tf.TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (t: string) => post({ type: "token", id: msg.id, text: t }),
      });
      const out = await model.generate({ ...inputs, max_new_tokens: msg.maxNewTokens, do_sample: false, streamer });
      const decoded = processor.batch_decode(out.slice(null, [inputs.input_ids.dims.at(-1), null]), { skip_special_tokens: true });
      post({ type: "done", id: msg.id, text: String(decoded[0] ?? "").trim() });
    }
  } catch (err) {
    post({ type: "error", id: "id" in msg ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
