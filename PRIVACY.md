# Privacy

## Default: everything on-device
| Data | Where it goes |
|---|---|
| Uploaded file | Read in the browser (PDF.js / Tesseract.js). Never uploaded, never stored. |
| Extracted results, report metadata | IndexedDB, encrypted with AES-GCM-256. The key is a non-extractable `CryptoKey` kept in the same browser. |
| Chat history | IndexedDB, encrypted the same way, per report. |
| Questions, prompts, AI output | Processed in the page or in a Web Worker (Gemma 4). Never sent anywhere. |
| Voice audio (mic) | Recorded and transcribed on-device (Whisper). Not stored. |
| Spoken answers | Generated on-device (Kokoro) by default. |
| Settings (theme, voice, speed, consent) | `localStorage`. Contains no medical data. |

## Network requests the app makes
- App files from the hosting origin; fonts from Google Fonts.
- **Model downloads** (only when a feature is turned on): Hugging Face (`huggingface.co`, `*.hf.co`) and `cdn.jsdelivr.net`. Model workers wrap `fetch` with an allowlist that permits only `GET`/`HEAD` requests without a body to those hosts. A request carrying a body cannot leave a worker.
- **Optional ElevenLabs cloud voice**: off by default. After an explicit consent dialog, the short narration sentence being spoken (≤ 600 characters) goes to this app's server function and then to ElevenLabs. The original report, the full result list and chat history are never sent. The server function does not log the text. Error messages contain only the HTTP status.

## User controls
- **Privacy page**: live status, voice provider, consent withdrawal, passcode-encrypted export/import, "clear downloaded models", and "Delete all local health data". Delete-all removes the IndexedDB database (reports, chats, key), `localStorage`, `sessionStorage` and Cache Storage.

## What we don't claim
- **Offline use**: not tested. App pages are not cached for offline use. Model files are cached by the browser after the first download.
- **Local key**: the on-device key protects data at rest from other sites and casual file access. It does not protect against someone using the same unlocked browser profile.
- **Plain exports**: per-report JSON exports from the Reports page are **not encrypted**. Use the encrypted backup on the Privacy page instead.
