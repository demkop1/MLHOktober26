import type { SttAdapter, TtsAdapter } from "./types";
import { createWorkerClient } from "./worker-client";

let kokoro: TtsAdapter | null = null;
let whisper: SttAdapter | null = null;
let cloud: TtsAdapter | null = null;

/** Kokoro-82M on-device TTS (WebGPU, CPU/WASM fallback). */
export function getKokoro(): TtsAdapter {
  if (kokoro) return kokoro;
  const c = createWorkerClient(() => new Worker(new URL("./kokoro.worker.ts", import.meta.url), { type: "module" }));
  kokoro = {
    id: "kokoro-82m",
    label: "Kokoro (on-device)",
    local: true,
    downloadSize: "about 90–330 MB, one-time",
    isLoaded: c.isLoaded,
    load: c.load,
    synthesize: (text) => c.call<Blob>({ text }),
  };
  return kokoro;
}

/** Whisper base on-device speech recognition. */
export function getWhisper(): SttAdapter {
  if (whisper) return whisper;
  const c = createWorkerClient(() => new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" }));
  whisper = {
    id: "whisper-base",
    label: "Whisper base (on-device)",
    downloadSize: "about 80–200 MB, one-time",
    isLoaded: c.isLoaded,
    load: c.load,
    transcribe: (audio) => c.call<string>({ audio }, [audio.buffer]),
  };
  return whisper;
}

/** ElevenLabs via our own server function. Only used after explicit consent. */
export function getCloudVoice(): TtsAdapter {
  if (cloud) return cloud;
  cloud = {
    id: "elevenlabs",
    label: "ElevenLabs (cloud)",
    local: false,
    downloadSize: null,
    isLoaded: () => true,
    load: async () => {},
    async synthesize(text) {
      const { synthesizeCloudVoice } = await import("./elevenlabs.functions");
      const { audioBase64 } = await synthesizeCloudVoice({ data: { text, consent: true } });
      const res = await fetch(`data:audio/mpeg;base64,${audioBase64}`);
      return res.blob();
    },
  };
  return cloud;
}

/** Record from the microphone and return 16 kHz mono samples. */
export async function recordUntilStopped(signal: AbortSignal): Promise<Float32Array> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  await new Promise<void>((r) => signal.addEventListener("abort", () => r(), { once: true }));
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  const buf = await new Blob(chunks).arrayBuffer();
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await ctx.decodeAudioData(buf);
    return new Float32Array(audio.getChannelData(0));
  } finally {
    void ctx.close();
  }
}
