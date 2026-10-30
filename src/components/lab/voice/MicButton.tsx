import { useRef, useState } from "react";
import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWhisper, recordUntilStopped } from "@/lib/speech/adapters";

type Phase = "idle" | "loading" | "recording" | "transcribing" | "error";

/** Records a question and transcribes it on-device. The text is only placed in the box for review. */
export function MicButton({ onTranscript, disabled }: { onTranscript: (t: string) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const start = async () => {
    setMsg(null);
    const w = getWhisper();
    try {
      if (!w.isLoaded()) {
        setPhase("loading");
        await w.load((p) => setMsg(`${p.label}${p.pct !== null ? ` · ${p.pct}%` : ""}`));
      }
      setMsg("Listening… tap stop when you're done.");
      setPhase("recording");
      abort.current = new AbortController();
      const audio = await recordUntilStopped(abort.current.signal);
      setPhase("transcribing");
      setMsg("Turning speech into text on this device…");
      const text = await w.transcribe(audio);
      if (!text) throw new Error("I didn't catch any words. Try again or type your question.");
      onTranscript(text);
      setMsg("Check the text, edit if needed, then press Send.");
      setPhase("idle");
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? (e.name === "NotAllowedError" ? "Microphone permission was denied. You can type instead." : e.message) : "Voice input failed. You can type instead.");
    }
  };

  if (!supported)
    return <Button type="button" size="icon" variant="ghost" disabled title="Voice input isn't supported in this browser. Please type." aria-label="Voice input unavailable"><MicOff className="h-4 w-4" /></Button>;

  return (
    <div className="relative">
      {phase === "recording" ? (
        <Button type="button" size="icon" variant="destructive" className="animate-pulse rounded-full" aria-label="Stop recording" onClick={() => abort.current?.abort()}>
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button type="button" size="icon" variant="outline" className="rounded-full" aria-label="Ask by voice" disabled={disabled || phase === "loading" || phase === "transcribing"} onClick={start}>
          {phase === "loading" || phase === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        </Button>
      )}
      {msg && (
        <p role="status" className={`absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-popover p-2 text-xs shadow-soft ${phase === "error" ? "text-destructive" : "text-popover-foreground"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
