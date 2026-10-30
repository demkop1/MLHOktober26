/**
 * Network guard for the model worker. Only model weights / runtime files may be downloaded, only with
 * GET and no body — so nothing about the patient can be sent.
 */
export const ALLOWED_MODEL_HOSTS = ["huggingface.co", "hf.co", "cdn.jsdelivr.net"];

export function isAllowedModelRequest(url: string, init?: { method?: string; body?: unknown }, selfOrigin?: string): boolean {
  let u: URL;
  try {
    u = new URL(url, selfOrigin);
  } catch {
    return false;
  }
  const method = (init?.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method) || init?.body != null) return false;
  if (u.protocol === "blob:" || u.protocol === "data:") return true;
  if (selfOrigin && u.origin === selfOrigin) return true;
  if (u.protocol !== "https:") return false;
  return ALLOWED_MODEL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

export function installFetchGuard(scope: { fetch: typeof fetch; location?: { origin: string } }) {
  const original = scope.fetch.bind(scope);
  scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    if (!isAllowedModelRequest(url, { method, body: init?.body }, scope.location?.origin))
      return Promise.reject(new Error(`Blocked network request to ${new URL(url, scope.location?.origin).host}`));
    return original(input, init);
  }) as typeof fetch;
}
