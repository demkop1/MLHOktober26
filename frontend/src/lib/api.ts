import type { Interpretation } from "./report-schema";

const API_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:8001";

// `file` is a data URL of an image or a PDF.
export async function interpretReport(input: { text?: string | undefined; file?: string | undefined }): Promise<Interpretation> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/interpret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Can't reach the LabLens server. Is the backend running?");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : "Something went wrong.");
  }
  return res.json();
}
