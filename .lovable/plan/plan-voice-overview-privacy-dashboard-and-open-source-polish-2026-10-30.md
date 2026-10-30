# Plan: Voice, overview, privacy dashboard and open-source polish

Everything that already works stays as it is: reading reports, checking values, the result rules, encrypted storage, the question-and-answer panel and the optional Gemma 4 model. Everything below is added on top.

## 1. Spoken explanations (on-device by default)
- **On-device voice:** uses Kokoro (an open speech model, about 90 MB when downloaded once) running in the browser. A status chip shows "Downloading voice… / Getting ready / Ready / Not available here".
- **Player bar:** Play, Pause, Stop, Replay and a speed setting (0.75×, 1×, 1.25×, 1.5×), all reachable by keyboard and labeled for screen readers.
- **What can be read aloud:**
  - each answer's short summary and "what it means" part;
  - a speaker button on every result card;
  - a short spoken overview of the report.
  Speech is kept short: summaries only, never whole tables.
- **If on-device speech fails:** an explicit message appears and the app does not switch to another voice. Text stays fully usable.

## 2. Optional premium cloud voice (ElevenLabs), off by default
- **Where it lives:** a clearly labeled switch on the new Privacy page. Turning it on opens a consent dialog explaining exactly what is sent:
  - only the short spoken sentence for that one answer or card;
  - never the report file, the full results list, or the chat history.
- **Ongoing reminder:** a "Cloud voice" badge shows on the player whenever it's active. Consent is stored on this device and can be withdrawn at any time.
- **Security:**
  - the narration is sent through a private server step; the voice service's key never reaches the browser;
  - narration text is never logged;
  - the request is limited in length and must carry the consent flag.
- **If the voice service isn't connected:** the switch stays disabled with the reason shown.
- **This needs your approval to connect ElevenLabs** when we build it. If you skip that step, the option stays off.

## 3. Ask by voice
- **How it works:** a microphone button in the question panel records your question. It is turned into text on this device using Whisper, an open speech-recognition model (about 80 MB, downloaded once).
- **Check before sending:** the text appears in the input box for you to read and edit. Nothing is asked until you press Send.
- **Hearing the answer:** the answer then goes through the existing question pipeline, and can be read aloud automatically if you turn that setting on.
- **If speech recognition is unavailable:** typing keeps working, and the mic button explains why it's unavailable.

## 4. Report overview
A new top section on the results page:
- **Short introduction:** a one-line written introduction with a "Listen" button.
- **Counts:** Below / Within / Above / Unknown, using the existing rules.
- **"Needs checking" list:** results that were never confirmed, or that couldn't be compared with a range.
- **Lab urgent/critical flags:** shown prominently only when the lab itself marked them (HH, LL, "critical", "panic"). The app never decides on its own that something is an emergency. This needs a small addition to how flags are read from reports.
- **No overall health score** or "all good" verdict anywhere.
- **Card actions:** each card gets "Explain this result", which opens the panel with an answer already asked, and "Ask a follow-up", which opens the panel with the test name filled in.

## 5. Visual upgrades
- **Range bar:** animates smoothly and respects the device's "reduce motion" setting. It gets a text description for screen readers ("11.2, below the lab range 12.0 to 15.5").
- **Trend chart:** a small trend chart on a card when earlier reports saved on this device have the same test with the same unit. Otherwise it says why there's no chart.
- **Layout:** on wide screens the question panel can sit next to the results instead of covering them. On phones it becomes a full-screen panel.
- **Light and dark mode:** a real dark theme in the same teal/blue style, plus a toggle in the header that remembers your choice. Contrast is checked in both.
- **Transitions:** smooth movement between upload, checking, overview and conversation.

## 6. Privacy page (new page, in the menu)
Live status, not fixed text:
- **Where AI answers come from:** the reference library, or Gemma 4 on this device, and whether Gemma is loaded.
- **Voice:** on-device, off, or cloud (ElevenLabs).
- **External services in use:** model downloads from Hugging Face, and the cloud voice only if turned on.
- **Where reports are stored:** encrypted in this browser, with the number of saved reports and chats.
- **Encrypted backup:** download all reports protected with a passcode you choose, and import that backup again.
- **Delete All Local Health Data:** deletes reports, chats, the encryption key and settings, after a confirmation step.
- **About model downloads:** what's downloaded, how big it is, where it's kept, how to clear it, and a "clear downloaded models" button.
- **Offline wording:** the page won't say it works offline. A "Test offline readiness" button checks which files are already saved and reports only what it found.

## 7. Open-source readiness
- **Documents:** README (setup, how it's built, the demo flow), PRIVACY.md, SECURITY.md, LICENSES.md (app, Gemma, Kokoro, Whisper, MedlinePlus and key libraries), BROWSER_SUPPORT.md (WebGPU, memory, Safari, Firefox and phone limits).
- **Synthetic demo reports:** 2 or 3 made-up reports (a baseline, a 6-month follow-up so trend charts show, and one with a lab "critical" flag), each as a PDF plus a text version. They can also be loaded with one click.
- **Configuration notes:** how to change models and how to turn on the cloud voice.

## 8. Demo flow and checks
- **Guided demo:** a "Guided demo" button on the home page walks through all 9 steps of your demo script. It uses real processing on the synthetic reports, with no pre-made "success" screens.
- **New automated checks:**
  - critical flags only come from the lab;
  - the overview counts match the existing rules;
  - trends only appear for the same test with the same unit;
  - cloud voice refuses without consent and only sends short text;
  - encrypted backup round-trips correctly;
  - "delete all" really empties storage;
  - the speech text never contains numbers that aren't on the report.
- **Browser checks:** upload a synthetic PDF, check the values, view the overview, explain a result, ask a follow-up, and confirm on the Privacy page.

## Known limitations to report after building
- **Not tested in my browser:** Gemma 4, Kokoro and Whisper downloads and speed can't be tested in my headless browser (no graphics card or sound). You'll need to try them in desktop Chrome or Edge.
- **Device support:** older devices, Safari and phones will often fall back to text-only.
- **Cloud voice:** needs a server step, so it's the one feature that sends data off the device, and only after consent.

## Technical details
- **New packages:** `kokoro-js` (model `onnx-community/Kokoro-82M-v1.0-ONNX`, WebGPU with WASM fallback, run in a Web Worker behind the existing netguard). Whisper via the already-installed `@huggingface/transformers` (`onnx-community/whisper-base`, worker plus netguard). A small chart library is not needed; trends are drawn in SVG.
- **Speech services:** `src/lib/speech/` with a `TtsAdapter` interface (`kokoro`, `elevenlabs`) and an `SttAdapter` (`whisper`), mirroring `LocalModelAdapter`. `narration.ts` builds short spoken text from `Answer`/`Observation` and reuses `validate.ts` number checks.
- **ElevenLabs:**
  - `createServerFn` in `src/lib/speech/elevenlabs.functions.ts`, which validates `{text ≤ 600 chars, consent: true}` with zod and reads `ELEVENLABS_API_KEY` inside the handler;
  - it returns base64 mp3 and does no logging;
  - it's linked via the ElevenLabs connector;
  - an AGENTS.md rule is updated to record this single opt-in exception.
- **Flags:**
  - the parser accepts "critical", "panic", "!!" and "HH"/"LL";
  - `LabFlag` gets a `critical` boolean (set only from the report text);
  - the engine is unchanged.
- **Storage:**
  - a Dexie `settings` table;
  - `exportEncrypted(passcode)` using PBKDF2 to derive an AES-GCM key and produce a `.clearlab` file, plus a matching import;
  - `wipeAll()` deletes the database and clears `caches` entries for model files.
- **Theme:** `.dark` tokens redefined in `src/styles.css`; class toggled from a `useEffect` in `__root`.
- **New route:** `src/routes/privacy.tsx`. The report page gets an overview component, card actions and a dockable chat panel controlled by state on the report page.
