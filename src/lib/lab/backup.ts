/** Passcode-protected backup: PBKDF2-SHA256 → AES-GCM-256. Pure Web Crypto, works offline. */
export interface BackupFile {
  format: "clearlab-backup";
  version: 1;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  iv: string;
  data: string;
}

const b64 = (u: Uint8Array) => btoa(Array.from(u, (c) => String.fromCharCode(c)).join(""));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const ITERATIONS = 310_000;

async function deriveKey(passcode: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passcode), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptBackup(payload: unknown, passcode: string, iterations = ITERATIONS): Promise<BackupFile> {
  if (passcode.length < 8) throw new Error("Use a passcode of at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt, iterations);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  return { format: "clearlab-backup", version: 1, kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: b64(salt) }, iv: b64(iv), data: b64(new Uint8Array(cipher)) };
}

export async function decryptBackup<T>(file: BackupFile, passcode: string): Promise<T> {
  if (file?.format !== "clearlab-backup" || file.version !== 1) throw new Error("This isn't a Clearlab backup file.");
  const key = await deriveKey(passcode, unb64(file.kdf.salt), file.kdf.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(file.iv) as BufferSource }, key, unb64(file.data) as BufferSource);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("Wrong passcode, or the file is damaged.");
  }
}
