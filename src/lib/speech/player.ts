import { useSyncExternalStore } from "react";
import { getSettings } from "@/lib/settings";
import { getCloudVoice, getKokoro } from "./adapters";
import type { TtsAdapter } from "./types";

export type PlayerStatus = "idle" | "loading" | "synthesizing" | "playing" | "paused" | "error";

export interface PlayerState {
  status: PlayerStatus;
  label: string | null;
  text: string | null;
  progress: { label: string; pct: number | null } | null;
  error: string | null;
  provider: "local" | "cloud" | null;
  voiceReady: boolean;
}

let state: PlayerState = { status: "idle", label: null, text: null, progress: null, error: null, provider: null, voiceReady: false };
const listeners = new Set<() => void>();
const set = (p: Partial<PlayerState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };

let audio: HTMLAudioElement | null = null;
let url: string | null = null;
let token = 0;

function provider(): TtsAdapter | null {
  const s = getSettings();
  if (s.voice === "off") return null;
  if (s.voice === "cloud" && s.cloudVoiceConsent.given) return getCloudVoice();
  return getKokoro();
}

export async function speak(text: string, label: string) {
  const p = provider();
  if (!p) return set({ status: "error", error: "Voice is turned off in Privacy settings.", label, text });
  const my = ++token;
  stopAudio();
  set({ status: p.isLoaded() ? "synthesizing" : "loading", label, text, error: null, provider: p.local ? "local" : "cloud" });
  try {
    if (!p.isLoaded()) await p.load((progress) => my === token && set({ progress }));
    if (my !== token) return;
    set({ status: "synthesizing", progress: null, voiceReady: true });
    const blob = await p.synthesize(text);
    if (my !== token) return;
    url = URL.createObjectURL(blob);
    play();
  } catch (e) {
    if (my !== token) return;
    // No automatic switch to another provider.
    set({ status: "error", error: `${p.local ? "On-device voice" : "Cloud voice"} isn't working here: ${e instanceof Error ? e.message : "unknown error"}. You can still read the text.`, progress: null });
  }
}

function play() {
  if (!url) return;
  audio = new Audio(url);
  audio.playbackRate = getSettings().speed;
  audio.onended = () => set({ status: "paused" });
  audio.play().then(() => set({ status: "playing" })).catch((e) => set({ status: "error", error: `Playback blocked: ${e.message}` }));
}

function stopAudio() {
  audio?.pause();
  audio = null;
  if (url) URL.revokeObjectURL(url);
  url = null;
}

export const pause = () => { audio?.pause(); set({ status: "paused" }); };
export const resume = () => {
  if (!audio) return play();
  void audio.play(); set({ status: "playing" });
};
export const replay = () => {
  if (!audio) return play();
  audio.currentTime = 0; void audio.play(); set({ status: "playing" });
};
export const stop = () => { token++; stopAudio(); set({ status: "idle", label: null, text: null, error: null, progress: null }); };
export const applySpeed = (s: number) => { if (audio) audio.playbackRate = s; };

export function usePlayer(): PlayerState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}
