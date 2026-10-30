import { Cpu, Loader2, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ModelState } from "./useLocalModel";

export function ModelStatus({ state, onLoad, downloadSize }: { state: ModelState; onLoad: () => void; downloadSize?: string | undefined }) {
  const box = "rounded-xl border border-border bg-card p-3 text-xs";
  switch (state.phase) {
    case "checking":
      return <div className={box}><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Checking if this device can run AI locally…</div>;
    case "ready":
      return <div className={box}><Cpu className="mr-1 inline h-3.5 w-3.5 text-status-in" />Gemma 4 is running on this device. Your questions never leave it.</div>;
    case "loading":
      return (
        <div className={box} aria-live="polite">
          <p><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />{state.progress.label}{state.progress.pct !== null && ` · ${state.progress.pct}%`}</p>
          {state.progress.pct !== null && <Progress value={state.progress.pct} className="mt-2 h-1.5" />}
          <p className="mt-1.5 text-muted-foreground">Only the model files are downloaded. You can keep asking — answers use the library until it's ready.</p>
        </div>
      );
    case "unsupported":
      return (
        <div className={box}>
          <p className="font-medium"><Library className="mr-1 inline h-3.5 w-3.5" />On-device AI isn't available here</p>
          {state.support.reasons.map((r) => <p key={r} className="mt-1 text-muted-foreground">{r}</p>)}
          <p className="mt-1 text-muted-foreground">Answers come from your report and the reference library instead. Nothing is sent online.</p>
        </div>
      );
    case "error":
      return (
        <div className={box}>
          <p className="font-medium text-destructive">The AI model couldn't load: {state.message}</p>
          <p className="mt-1 text-muted-foreground">Answers come from the reference library instead.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onLoad}>Try again</Button>
        </div>
      );
    case "idle":
      return (
        <div className={box}>
          <p><Library className="mr-1 inline h-3.5 w-3.5" />Answers come from your report and the reference library.</p>
          <p className="mt-1 text-muted-foreground">
            Optionally turn on Gemma 4 for friendlier wording. It runs entirely in this browser ({downloadSize}); your report is never sent anywhere.
          </p>
          <Button size="sm" className="mt-2 rounded-full bg-gradient-brand" onClick={onLoad}><Cpu className="h-3.5 w-3.5" /> Turn on on-device AI</Button>
        </div>
      );
  }
}
