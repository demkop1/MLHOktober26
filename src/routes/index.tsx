import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Upload, Eye, HardDrive, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clearlab — Understand your lab reports" },
      { name: "description", content: "Understand your lab reports in simple language. Private by design: everything stays on your device." },
      { property: "og:title", content: "Clearlab — Understand your lab reports" },
      { property: "og:description", content: "Plain-language lab report explainer that runs entirely on your device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: HardDrive, t: "Stays on your device", d: "Reports are read, explained and spoken in your browser and stored encrypted locally. Nothing is uploaded." },
  { icon: Eye, t: "You verify every value", d: "Check and correct what we read before anything is explained." },
  { icon: LineChart, t: "Clear, honest results", d: "See where each value sits in your lab's own range — and what we're unsure about." },
];

function Index() {
  return (
    <main className="bg-hero">
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center md:pt-28">
        <span className="fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
          <ShieldCheck className="h-3.5 w-3.5 text-status-in" /> Private by design — no uploads, no accounts
        </span>
        <h1 className="fade-up mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] md:text-6xl">
          Understand your lab reports in <em className="text-primary">simple language.</em>
        </h1>
        <p className="fade-up mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Drop in a PDF or photo of your results. Clearlab turns rows of numbers into clear, friendly cards you can actually read.
        </p>
        <div className="fade-up mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full bg-gradient-brand px-7 shadow-soft">
            <Link to="/upload"><Upload className="h-4 w-4" /> Upload report</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/upload" search={{ sample: true }}>Try a sample report</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="rounded-full">
            <Link to="/demo">Guided demo</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.t} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <f.icon className="h-6 w-6 text-primary" />
            <h2 className="mt-4 text-xl font-semibold">{f.t}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
        <p className="col-span-full mt-4 text-center text-xs text-muted-foreground">
          Clearlab explains what tests measure. It does not diagnose conditions or replace advice from your clinician.
        </p>
      </section>
    </main>
  );
}
