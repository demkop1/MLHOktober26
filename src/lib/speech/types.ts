export interface SpeechProgress {
  label: string;
  pct: number | null;
}

/** Text-to-speech provider. `local: true` means audio is generated on this device. */
export interface TtsAdapter {
  id: string;
  label: string;
  local: boolean;
  downloadSize: string | null;
  isLoaded(): boolean;
  load(onProgress: (p: SpeechProgress) => void): Promise<void>;
  synthesize(text: string): Promise<Blob>;
}

/** Speech-to-text provider; always on-device in this app. */
export interface SttAdapter {
  id: string;
  label: string;
  downloadSize: string;
  isLoaded(): boolean;
  load(onProgress: (p: SpeechProgress) => void): Promise<void>;
  transcribe(audio16k: Float32Array): Promise<string>;
}
