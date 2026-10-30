# Clearlab — privacy-first lab report explainer

Clearlab helps patients understand laboratory reports in plain language. Reports are read, compared, explained, and optionally spoken **in the browser**. Nothing about the patient is sent to a server unless the user explicitly turns on the optional cloud voice.

> Educational tool only. It does not diagnose, predict disease, or recommend treatment.

## Features
- **Upload** PDF / PNG / JPEG. Text is extracted with PDF.js, and with Tesseract.js OCR for scans.
- **Verify** every extracted row (editable, with source page and OCR confidence). Unreadable numbers are never guessed.
- **Overview**: counts of results below, within and above the lab's own ranges. Lab-marked critical values are highlighted (never invented). Results that need checking are listed.
- **Result cards**: animated, accessible range bars, trend charts (same test and unit only), "Explain this result" and "Ask a follow-up".
- **Q&A**: deterministic structured retrieval plus a curated knowledge base, optionally reworded by **Gemma 4 E2B** on WebGPU. Output is validated: no new numbers and no diagnoses.
- **Voice**: Kokoro-82M on-device text-to-speech, Whisper on-device speech-to-text, and optional ElevenLabs cloud voice behind explicit consent.
- **Privacy page**: live status, passcode-encrypted backup and import, delete-all, model cache management.
- **Guided demo** (`/demo`) using synthetic reports in `demo-reports/`.

## Quick start
```bash
bun install
bun run dev        # http://localhost:8080
bunx vitest run    # tests
```

## Architecture
```text
src/lib/lab/       extraction (extract.ts), parsing (parser.ts), deterministic status engine (engine.ts),
                   encrypted IndexedDB storage (storage.ts), backup (backup.ts), trends (trends.ts)
src/lib/ai/        knowledge.json (curated, sourced) -> retrieval.ts (exact lookup) -> answer.ts (grounded Answer)
                   -> assistant.ts (optional model rewording) -> validate.ts (reject new numbers/diagnoses)
                   model/  LocalModelAdapter + Gemma 4 worker + netguard (GET-only model-host allowlist)
src/lib/speech/    narration.ts (short spoken text), TtsAdapter/SttAdapter, Kokoro and Whisper workers,
                   player.ts (play/pause/stop/replay/speed), elevenlabs.functions.ts (server, consent-gated)
src/components/lab UI: ResultCard, ReportOverview, TrendChart, chat/, voice/
src/routes/        /, /upload, /report/$id, /history, /privacy, /demo
```
Patient facts always come from structured report data. Models only reword the general-information part of an answer, and anything they write is validated.

## Configuration
- **Swap the LLM**: implement `LocalModelAdapter` (`src/lib/ai/model/types.ts`) and return it from `useLocalModel`.
- **Swap voices**: implement `TtsAdapter` / `SttAdapter` (`src/lib/speech/types.ts`). Model IDs live in the worker files.
- **Cloud voice (optional)**: provide `ELEVENLABS_API_KEY` as a **server-side** secret. Without it the toggle stays disabled. The key is only read inside the server function.
- **Allowed model hosts**: `ALLOWED_MODEL_HOSTS` in `src/lib/ai/model/netguard.ts`.

## Demo flow
1. Open `/demo` and optionally add the September 2025 report (gives trend history).
2. Start: the March 2026 synthetic PDF is processed by the real PDF pipeline.
3. Verify rows, save, view the overview.
4. Press "Explain this result" on Hemoglobin. Ask a follow-up by text or microphone.
5. Open "Sources", press the speaker to narrate, then visit `/privacy`.

## Documentation
- [PRIVACY.md](PRIVACY.md) — data flows
- [SECURITY.md](SECURITY.md) — threat model and reporting
- [LICENSES.md](LICENSES.md) — models, content, dependencies
- [BROWSER_SUPPORT.md](BROWSER_SUPPORT.md) — device requirements and limitations

## Tests
`bunx vitest run` covers parsing, numeric accuracy, missing-range handling, critical flags only from the lab, overview counts, trends, narration grounding, cloud-voice consent validation, the network allowlist, encrypted backup, and delete-all.
