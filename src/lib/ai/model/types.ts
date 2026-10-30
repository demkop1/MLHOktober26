import type { ChatMessage } from "../prompt";

export interface SupportReport {
  supported: boolean;
  reasons: string[];
  details: { webgpu: boolean; shaderF16: boolean; maxBufferMB: number | null; deviceMemoryGB: number | null };
}

export interface LoadProgress {
  label: string;
  /** 0–100, or null when unknown. */
  pct: number | null;
}

/** Any on-device text model. Implementations must never send prompts or outputs off the device. */
export interface LocalModelAdapter {
  id: string;
  label: string;
  downloadSize: string;
  checkSupport(): Promise<SupportReport>;
  load(onProgress: (p: LoadProgress) => void): Promise<void>;
  generate(messages: ChatMessage[], onToken?: (t: string) => void): Promise<string>;
  isLoaded(): boolean;
}

/** Minimal surface the answer pipeline needs; lets tests pass a stub. */
export type TextGenerator = Pick<LocalModelAdapter, "generate" | "label">;
