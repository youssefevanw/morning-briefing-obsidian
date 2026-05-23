import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Mirrors the keys the Focus Fox desktop app writes into electron-store.
// Only the fields we actually read are typed; the rest pass through as unknown.
export interface FocusFoxCalEvent {
  start: string;       // ISO 8601 UTC, e.g. "2026-05-22T14:30:00.000Z"
  end: string;         // ISO 8601 UTC
  summary: string;
  source?: string;     // e.g. "gcal:user@domain"
}

export interface FocusFoxSession {
  id: string;
  project: string;
  subproject?: string;
  phase: string;
  dur: number;         // seconds
  startTs: string;     // ISO 8601
  endTs: string;       // ISO 8601
  intention?: string;
  note?: string;
  mood?: string;
}

export interface FocusFoxStore {
  ft9_cal?: FocusFoxCalEvent[];
  ft9_log?: FocusFoxSession[];
  [key: string]: unknown;
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}

export async function readFocusFoxStore(storePath: string): Promise<FocusFoxStore> {
  const resolved = expandHome(storePath);
  const raw = await fsp.readFile(resolved, "utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw) as FocusFoxStore;
}
