import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_NARRATION_CHARS } from "./narration";

/** Short narration only, and only with explicit consent. Text is never logged or stored. */
export const cloudVoiceInput = z.object({
  text: z.string().trim().min(1).max(MAX_NARRATION_CHARS),
  consent: z.literal(true),
});

const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

export const synthesizeCloudVoice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cloudVoiceInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) throw new Error("Cloud voice isn't set up for this app.");
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text, model_id: "eleven_turbo_v2_5" }),
    });
    if (!res.ok) {
      // Status only — never include the submitted text.
      throw new Error(`Cloud voice failed (status ${res.status}).`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { audioBase64: btoa(bin) };
  });

export const cloudVoiceStatus = createServerFn({ method: "GET" }).handler(async () => ({
  configured: !!process.env["ELEVENLABS_API_KEY"],
}));
