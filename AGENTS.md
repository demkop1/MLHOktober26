<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Patient data never leaves the browser: extraction (pdfjs/tesseract, lazy-imported in src/lib/lab/extract.ts), storage (Dexie + AES-GCM in src/lib/lab/storage.ts) are client-only; no backend or hosted AI for report data. Why: privacy-first requirement.
- Result status comes only from the deterministic engine in src/lib/lab/engine.ts using ranges printed on the report; never invent ranges. Tests in engine.test.ts.
- Q&A pipeline (src/lib/ai): retrieval.ts does exact structured lookup → answer.ts builds a deterministic, sourced Answer → an optional LocalModelAdapter (model/) may only reword "What it means", and validate.ts rejects new numbers/diagnoses. Why: every patient fact must trace to the report; the model is never the source of truth.
- Local models run in a Web Worker behind model/netguard.ts (GET-only allowlist to model hosts); never add a hosted LLM fallback. Why: prompts and results must stay on-device.
- Educational content lives in src/lib/ai/knowledge.json with per-entry sources and licenses. Why: auditable, open-source friendly.
- Speech (src/lib/speech): Kokoro TTS and Whisper STT run in Web Workers behind netguard; Kokoro imports kokoro-js's self-contained web build because the bundled phonemizer breaks under Vite. Why: on-device default, verified working.
- Single opt-in exception to on-device processing: ElevenLabs narration via elevenlabs.functions.ts, only with stored consent, ≤600 chars of narration, no logging. Never send reports, full results or chat history. Why: user-requested premium voice with explicit consent.
- Critical flags come only from lab markers (HH/LL, critical, panic, !!) in parser.ts; the app never derives urgency itself. Why: avoid invented emergency classifications.
