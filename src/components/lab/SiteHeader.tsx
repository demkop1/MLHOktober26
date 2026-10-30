import { Link } from "@tanstack/react-router";
import { ShieldCheck, Activity, Moon, Sun } from "lucide-react";
import { updateSettings, useSettings } from "@/lib/settings";

export function SiteHeader() {
  const s = useSettings();
  const link = "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
  const active = { className: "bg-secondary text-foreground" };
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
            <Activity className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Clearlab</span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Main">
          <Link to="/upload" className={link} activeProps={active}>Upload</Link>
          <Link to="/history" className={link} activeProps={active}>Reports</Link>
          <Link to="/privacy" className={link} activeProps={active}>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-status-in" />Privacy</span>
          </Link>
          <button
            onClick={() => updateSettings({ theme: s.theme === "dark" ? "light" : "dark" })}
            className="ml-1 grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={s.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {s.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
