import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Cloud, Cpu, Database, Download, HardDrive, Loader2, ShieldCheck, Trash2, Upload, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocalModel } from "@/components/lab/chat/useLocalModel";
import { decryptBackup, encryptBackup, type BackupFile } from "@/lib/lab/backup";
import { clearModelCaches, listChatsRaw, listReports, saveChat, saveReport, storageCounts, wipeAllLocalData } from "@/lib/lab/storage";
import type { LabReport } from "@/lib/lab/types";
import { resetSettingsCache, updateSettings, useSettings } from "@/lib/settings";
import { stop } from "@/lib/speech/player";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & data — Clearlab" },
      { name: "description", content: "See where your health data lives, which services are used, and delete or back up everything." },
      { property: "og:title", content: "Privacy & data — Clearlab" },
      { property: "og:description", content: "Live privacy dashboard for the on-device lab report explainer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const MODELS = [
  { name: "Gemma 4 E2B (q4f16)", purpose: "Optional wording of explanations", size: "≈ 3 GB", host: "huggingface.co", license: "Gemma license / Apache-2.0 (ONNX build)" },
  { name: "Kokoro-82M", purpose: "On-device voice", size: "≈ 90–330 MB", host: "huggingface.co", license: "Apache-2.0" },
  { name: "Whisper base", purpose: "On-device speech recognition", size: "≈ 80–200 MB", host: "huggingface.co", license: "MIT" },
  { name: "Tesseract English data", purpose: "Reading scanned images", size: "≈ 10–20 MB", host: "cdn.jsdelivr.net", license: "Apache-2.0" },
];

function Row({ icon: Icon, title, value, tone = "ok" }: { icon: typeof Cpu; title: string; value: React.ReactNode; tone?: "ok" | "warn" | "off" }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone === "ok" ? "bg-status-in-soft text-status-in" : tone === "warn" ? "bg-status-high-soft text-status-high" : "bg-muted text-muted-foreground")}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 text-sm"><p className="font-medium">{title}</p><div className="text-muted-foreground">{value}</div></div>
    </div>
  );
}

function PrivacyPage() {
  const s = useSettings();
  const { state: model } = useLocalModel();
  const [counts, setCounts] = useState<{ reports: number; chats: number } | null>(null);
  const [cloudConfigured, setCloudConfigured] = useState<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [offline, setOffline] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => storageCounts().then(setCounts).catch(() => setCounts({ reports: 0, chats: 0 }));
  useEffect(() => {
    refresh();
    import("@/lib/speech/elevenlabs.functions")
      .then((m) => m.cloudVoiceStatus())
      .then((r) => setCloudConfigured(r.configured))
      .catch(() => setCloudConfigured(false));
  }, []);

  const exportAll = async () => {
    setBusy(true); setMsg(null);
    try {
      const file = await encryptBackup({ reports: await listReports(), chats: await listChatsRaw() }, pass);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
      a.download = `clearlab-backup-${new Date().toISOString().slice(0, 10)}.clearlab`;
      a.click();
      setMsg("Encrypted backup downloaded. Keep the passcode safe — it can't be recovered.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Backup failed."); }
    setBusy(false);
  };

  const importFile = async (f: File) => {
    setBusy(true); setMsg(null);
    try {
      const data = await decryptBackup<{ reports: LabReport[]; chats: { reportId: string; messages: unknown[] }[] }>(JSON.parse(await f.text()) as BackupFile, pass);
      for (const r of data.reports) await saveReport(r);
      for (const c of data.chats) await saveChat(c.reportId, c.messages);
      setMsg(`Restored ${data.reports.length} report(s) and ${data.chats.length} chat(s).`);
      refresh();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Import failed."); }
    setBusy(false);
  };

  const testOffline = async () => {
    if (typeof caches === "undefined") return setOffline(["This browser doesn't expose its download cache, so offline readiness can't be checked."]);
    const out: string[] = [];
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys();
      const ids = new Set(keys.map((k) => k.url.match(/huggingface\.co\/([^/]+\/[^/]+)/)?.[1]).filter(Boolean));
      out.push(`${name}: ${keys.length} file(s)${ids.size ? ` from ${[...ids].join(", ")}` : ""}`);
    }
    if (!out.length) out.push("No model files are saved yet.");
    out.push("The app pages themselves are not saved for offline use, so an internet connection is still needed to open the app. Offline use has not been tested.");
    setOffline(out);
  };

  const gemma = model.phase === "ready" ? "Gemma 4 is loaded and running on this device." : model.phase === "loading" ? "Gemma 4 is downloading." : model.phase === "unsupported" ? "Gemma 4 isn't supported on this device; answers come from the reference library." : "Gemma 4 is off; answers come from the reference library on this device.";

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-semibold md:text-4xl"><ShieldCheck className="h-8 w-8 text-status-in" /> Privacy & data</h1>
        <p className="mt-2 text-muted-foreground">Live status of where your information goes. Nothing on this page is pre-filled.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Status">
        <Row icon={Cpu} title="AI answers" value={<>All answer logic runs on this device. {gemma}</>} />
        <Row icon={s.voice === "cloud" ? Cloud : Cpu} tone={s.voice === "cloud" ? "warn" : s.voice === "off" ? "off" : "ok"} title="Voice"
          value={s.voice === "cloud" ? "Cloud voice (ElevenLabs) is ON: short narration text is sent to ElevenLabs." : s.voice === "off" ? "Voice is off." : "On-device voice (Kokoro). Speech recognition (Whisper) also runs on this device."} />
        <Row icon={Wifi} tone={s.voice === "cloud" ? "warn" : "ok"} title="External services"
          value={<>Model downloads only (Hugging Face, jsDelivr) — no report data is sent. {s.voice === "cloud" ? "ElevenLabs: enabled." : "ElevenLabs: disabled."} Fonts load from Google Fonts.</>} />
        <Row icon={Database} title="Where reports are stored"
          value={counts ? `Encrypted (AES-GCM) in this browser's IndexedDB: ${counts.reports} report(s), ${counts.chats} chat(s). The key never leaves this browser.` : "Checking…"} />
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-xl font-semibold">Voice settings</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Voice provider">
          {(["local", "off"] as const).map((v) => (
            <Button key={v} role="radio" aria-checked={s.voice === v} variant={s.voice === v ? "default" : "outline"} className="rounded-full" onClick={() => { stop(); updateSettings({ voice: v }); }}>
              {v === "local" ? "On-device voice" : "Voice off"}
            </Button>
          ))}
        </div>
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-border p-4">
          <div className="text-sm">
            <p className="font-medium"><Cloud className="mr-1 inline h-4 w-4" />Premium cloud voice (ElevenLabs)</p>
            <p className="text-muted-foreground">Off by default. When on, the short sentence being read aloud is sent to ElevenLabs. Your report file, full results and chat history are never sent.</p>
            {cloudConfigured === false && <p className="mt-1 text-xs text-status-high">Not available: the cloud voice hasn't been set up for this app.</p>}
          </div>
          <Switch
            aria-label="Use cloud voice"
            checked={s.voice === "cloud"}
            disabled={!cloudConfigured}
            onCheckedChange={(on) => { stop(); if (on) setConsentOpen(true); else updateSettings({ voice: "local", cloudVoiceConsent: { given: false, at: null } }); }}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-xl font-semibold">Encrypted backup</h2>
        <p className="text-sm text-muted-foreground">Download all reports and chats as a file locked with your passcode (PBKDF2 + AES-GCM), or restore one.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="password" aria-label="Backup passcode" placeholder="Passcode (8+ characters)" className="max-w-xs" value={pass} onChange={(e) => setPass(e.target.value)} />
          <Button variant="outline" disabled={busy || pass.length < 8} onClick={exportAll}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export</Button>
          <Button variant="outline" disabled={busy || pass.length < 8} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import</Button>
          <input ref={fileRef} type="file" accept=".clearlab,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-xl font-semibold">About model downloads</h2>
        <p className="text-sm text-muted-foreground">Models download only when you turn on a feature. They're fetched with plain downloads (no report data attached) and saved in this browser's cache so they don't download again.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="py-2 pr-3">Model</th><th className="pr-3">Used for</th><th className="pr-3">Size</th><th className="pr-3">From</th><th>License</th></tr></thead>
            <tbody>{MODELS.map((m) => <tr key={m.name} className="border-t border-border"><td className="py-2 pr-3 font-medium">{m.name}</td><td className="pr-3">{m.purpose}</td><td className="pr-3">{m.size}</td><td className="pr-3">{m.host}</td><td>{m.license}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={testOffline}><HardDrive className="h-4 w-4" /> Test offline readiness</Button>
          <Button variant="outline" onClick={async () => { const n = await clearModelCaches(); setOffline([`Cleared ${n} cache(s). Models will download again when needed.`]); }}>Clear downloaded models</Button>
        </div>
        {offline && <ul className="space-y-1 text-sm text-muted-foreground" role="status">{offline.map((o) => <li key={o}>• {o}</li>)}</ul>}
      </section>

      <section className="rounded-3xl border border-destructive/40 bg-card p-5">
        <h2 className="text-xl font-semibold">Delete all local health data</h2>
        <p className="mt-1 text-sm text-muted-foreground">Removes every report, chat, the encryption key, settings and downloaded models from this browser. This can't be undone.</p>
        <Button variant="destructive" className="mt-3" onClick={() => setWipeOpen(true)}><Trash2 className="h-4 w-4" /> Delete everything</Button>
      </section>

      <AlertDialog open={consentOpen} onOpenChange={setConsentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send narration to ElevenLabs?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>With cloud voice on, each time you press Listen the short sentence being read (for example "Hemoglobin: 11.2 grams per deciliter, below range") is sent to ElevenLabs, a company outside this device, to create audio.</p>
                <p>Never sent: your report file, the full list of results, or your chat history. The text is not logged by this app.</p>
                <p>You can turn this off any time on this page.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep on-device voice</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateSettings({ voice: "cloud", cloudVoiceConsent: { given: true, at: Date.now() } })}>I understand, turn on</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all health data on this device?</AlertDialogTitle>
            <AlertDialogDescription>All {counts?.reports ?? 0} report(s) and {counts?.chats ?? 0} chat(s) will be permanently removed. Export a backup first if you want to keep them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { stop(); await wipeAllLocalData(); resetSettingsCache(); await refresh(); setMsg("All local health data was deleted."); }}
            >
              Delete everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
