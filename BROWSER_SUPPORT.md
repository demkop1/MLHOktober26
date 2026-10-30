# Browser and device support

| Feature | Requires | Notes |
|---|---|---|
| Upload, verify, overview, cards, library answers, storage, backup | Any modern browser with IndexedDB and Web Crypto | Tested in headless Chromium. |
| OCR for images or scanned PDFs | WebAssembly | Slow on phones. One-time ~10–20 MB language-data download. |
| Gemma 4 E2B answers | WebGPU with `shader-f16`, ≥ 4 GB GPU memory, roughly ≥ 1 GB max buffer | Desktop Chrome/Edge 113+. One-time download of about 3 GB. Not tested by us on real hardware. |
| Kokoro voice | WebGPU (fast) or WASM (slower) | 90–330 MB download depending on backend. Not tested with audio output. |
| Whisper voice questions | Microphone permission, MediaRecorder, WASM or WebGPU | 80–200 MB download. Not tested with a real microphone. |
| Cloud voice (ElevenLabs) | Server secret configured, user consent | Disabled when not configured. |

## Known limitations
- **Safari / iOS**: WebGPU support varies and memory limits are low. Expect library answers and possibly no on-device voice.
- **Firefox**: WebGPU is limited on many platforms, so Gemma will often be unavailable. Kokoro and Whisper may fall back to WASM.
- **Phones**: large models usually don't fit. The app falls back to text, with an explicit message.
- **Offline**: not tested. App pages are not saved for offline use.
- **Language**: report parsing and voices assume English.
- **Unit conversion**: not performed. Results with mismatched units show Unknown.
