import type { SupportReport } from "./types";

interface GPUAdapterLike {
  features: { has(f: string): boolean };
  limits: { maxBufferSize: number };
}

/** Check WebGPU and rough resources. Runs in the browser only. */
export async function detectWebGPU(minBufferMB = 1024): Promise<SupportReport> {
  const reasons: string[] = [];
  const nav = (typeof navigator !== "undefined" ? navigator : {}) as Navigator & {
    gpu?: { requestAdapter(o?: unknown): Promise<GPUAdapterLike | null> };
    deviceMemory?: number;
  };
  const details: SupportReport["details"] = { webgpu: false, shaderF16: false, maxBufferMB: null, deviceMemoryGB: nav.deviceMemory ?? null };
  if (!nav.gpu) {
    reasons.push("This browser doesn't support WebGPU. Try a recent Chrome or Edge on desktop.");
    return { supported: false, reasons, details };
  }
  const adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" }).catch(() => null);
  if (!adapter) {
    reasons.push("WebGPU is available but no compatible graphics adapter was found.");
    return { supported: false, reasons, details };
  }
  details.webgpu = true;
  details.shaderF16 = adapter.features.has("shader-f16");
  details.maxBufferMB = Math.round(adapter.limits.maxBufferSize / 1024 / 1024);
  if (!details.shaderF16) reasons.push("Your graphics adapter lacks 16-bit shader support (shader-f16), which this model build needs.");
  if (details.maxBufferMB < minBufferMB) reasons.push(`Your graphics adapter allows only ${details.maxBufferMB} MB per buffer; the model needs more.`);
  if (details.deviceMemoryGB !== null && details.deviceMemoryGB < 4) reasons.push("This device reports less than 4 GB of memory, which is likely too little.");
  return { supported: reasons.length === 0, reasons, details };
}
