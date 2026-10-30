import Dexie, { type Table } from "dexie";
import type { LabReport } from "./types";

interface EncryptedRow {
  id: string;
  createdAt: number;
  iv: Uint8Array;
  cipher: ArrayBuffer;
}
interface KeyRow {
  id: string;
  key: CryptoKey;
}

class LabDB extends Dexie {
  reports!: Table<EncryptedRow, string>;
  chats!: Table<EncryptedRow, string>;
  keys!: Table<KeyRow, string>;
  constructor() {
    super("lab-explainer");
    this.version(1).stores({ reports: "id, createdAt", keys: "id" });
    this.version(2).stores({ reports: "id, createdAt", keys: "id", chats: "id, createdAt" });
  }
}

let db: LabDB | null = null;
const getDb = () => (db ??= new LabDB());

/** Non-extractable AES-GCM key generated and kept on this device only. */
async function getKey(): Promise<CryptoKey> {
  const existing = await getDb().keys.get("main");
  if (existing) return existing.key;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await getDb().keys.put({ id: "main", key });
  return key;
}

async function encrypt(id: string, createdAt: number, value: unknown): Promise<EncryptedRow> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { id, createdAt, iv, cipher };
}

async function decryptAny<T>(row: EncryptedRow): Promise<T> {
  const key = await getKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv as BufferSource }, key, row.cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}
const decrypt = (row: EncryptedRow) => decryptAny<LabReport>(row);

export async function saveReport(report: LabReport) {
  await getDb().reports.put(await encrypt(report.id, report.createdAt, report));
}

/** Chat history per report, encrypted with the same on-device key. */
export async function saveChat<T>(reportId: string, messages: T[]) {
  await getDb().chats.put(await encrypt(reportId, Date.now(), messages));
}
export async function loadChat<T>(reportId: string): Promise<T[]> {
  const row = await getDb().chats.get(reportId);
  return row ? decryptAny<T[]>(row) : [];
}
export const deleteChat = (reportId: string) => getDb().chats.delete(reportId);

export async function getReport(id: string) {
  const row = await getDb().reports.get(id);
  return row ? decrypt(row) : null;
}

export async function listReports(): Promise<LabReport[]> {
  const rows = await getDb().reports.orderBy("createdAt").reverse().toArray();
  return Promise.all(rows.map(decrypt));
}

export const deleteReport = async (id: string) => {
  await getDb().reports.delete(id);
  await getDb().chats.delete(id);
};

export function exportReport(r: LabReport) {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${r.title.replace(/[^\w-]+/g, "_") || "lab-report"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function storageCounts() {
  const d = getDb();
  return { reports: await d.reports.count(), chats: await d.chats.count() };
}

export async function listChatsRaw<T>(): Promise<{ reportId: string; messages: T[] }[]> {
  const rows = await getDb().chats.toArray();
  return Promise.all(rows.map(async (r) => ({ reportId: r.id, messages: await decryptAny<T[]>(r) })));
}

/** Delete every report, chat, the device key, settings and downloaded model files. */
export async function wipeAllLocalData() {
  if (db) db.close();
  db = null;
  await Dexie.delete("lab-explainer");
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  await clearModelCaches();
}

/** Model weights are kept by the browser in Cache Storage (Transformers.js uses "transformers-cache"). */
export async function clearModelCaches() {
  if (typeof caches === "undefined") return 0;
  const names = await caches.keys();
  await Promise.all(names.map((n) => caches.delete(n)));
  return names.length;
}
