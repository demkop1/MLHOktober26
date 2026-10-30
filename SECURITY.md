# Security

## Model
- **No backend for patient data.** The only server code is the consent-gated ElevenLabs function (`src/lib/speech/elevenlabs.functions.ts`). It validates `{ text ≤ 600 chars, consent: true }` with zod, reads `ELEVENLABS_API_KEY` only inside the handler, and never logs the text.
- **Secrets**: no API keys in client code. `VITE_*` variables must never hold secrets.
- **Prompt injection**: report text and reference text are placed in tagged blocks marked as untrusted data. The model only rewords general information, and `validate.ts` rejects any output with numbers not present in the report facts, diagnostic language, treatment advice or false certainty.
- **Network allowlist** for model workers: `src/lib/ai/model/netguard.ts`.
- **Storage**: AES-GCM-256 with a non-extractable device key. Backups use PBKDF2-SHA-256 (310,000 iterations) and AES-GCM-256.

## Known limitations
- Anyone with access to the same unlocked browser profile can open the app and read stored reports.
- Third-party model files are trusted as published on Hugging Face. Pin revisions for higher assurance.

## Reporting
Please open a private security advisory on the repository rather than a public issue.
