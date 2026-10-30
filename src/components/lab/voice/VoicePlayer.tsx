import { Loader2, Pause, Play, RotateCcw, Square, Volume2, Cloud, Cpu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { applySpeed, pause, replay, resume, speak, stop, usePlayer } from "@/lib/speech/player";
import { updateSettings, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5];

/** Persistent bottom player. Appears whenever something is being spoken. */
export function VoicePlayer() {
  const p = usePlayer();
  const s = useSettings();
  if (p.status === "idle") return null;
  const busy = p.status === "loading" || p.status === "synthesizing";

  return (
    <div role="region" aria-label="Voice player" className="fade-up fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", p.provider === "cloud" ? "bg-status-high-soft text-status-high" : "bg-status-in-soft text-status-in")}>
          {p.provider === "cloud" ? <><Cloud className="h-3.5 w-3.5" /> Cloud voice</> : <><Cpu className="h-3.5 w-3.5" /> On-device voice</>}
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate text-sm font-medium">{p.label}</p>
          {p.status === "error" ? (
            <p className="text-xs text-destructive">{p.error}</p>
          ) : busy ? (
            <div className="text-xs text-muted-foreground">
              {p.progress ? `${p.progress.label}${p.progress.pct !== null ? ` · ${p.progress.pct}%` : ""}` : p.status === "loading" ? "Getting the voice ready…" : "Preparing speech…"}
              {p.progress?.pct != null && <Progress value={p.progress.pct} className="mt-1 h-1" />}
            </div>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{p.text}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="Loading" />}
          {p.status === "playing" && <Button size="icon" variant="ghost" aria-label="Pause" onClick={pause}><Pause className="h-4 w-4" /></Button>}
          {p.status === "paused" && <Button size="icon" variant="ghost" aria-label="Play" onClick={resume}><Play className="h-4 w-4" /></Button>}
          {(p.status === "playing" || p.status === "paused") && <Button size="icon" variant="ghost" aria-label="Replay" onClick={replay}><RotateCcw className="h-4 w-4" /></Button>}
          {p.status === "error" && p.text && p.label && <Button size="sm" variant="outline" onClick={() => speak(p.text!, p.label!)}>Try again</Button>}
          <label className="sr-only" htmlFor="voice-speed">Playback speed</label>
          <select
            id="voice-speed"
            className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
            value={s.speed}
            onChange={(e) => { const v = Number(e.target.value); updateSettings({ speed: v }); applySpeed(v); }}
          >
            {SPEEDS.map((v) => <option key={v} value={v}>{v}×</option>)}
          </select>
          <Button size="icon" variant="ghost" aria-label={p.status === "error" ? "Close" : "Stop"} onClick={stop}>
            {p.status === "error" ? <X className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SpeakButton({ text, label, className, children }: { text: string; label: string; className?: string; children?: React.ReactNode }) {
  const s = useSettings();
  if (s.voice === "off") return null;
  return (
    <Button size={children ? "sm" : "icon"} variant="ghost" className={className} aria-label={`Listen: ${label}`} onClick={() => speak(text, label)}>
      <Volume2 className="h-4 w-4" />{children}
    </Button>
  );
}
