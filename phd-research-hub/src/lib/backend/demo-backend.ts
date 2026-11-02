// Browser-only backend used ONLY when Supabase is not configured (local trial).
// In production (env vars set) the Supabase backend is always used.
import { NORMALIZERS, normalizeSettings } from "../factories";
import { TABLES, type Snapshot } from "../types";
import { uid } from "../utils";
import type { Backend, ImageKind, SyncOp } from "./types";

const KEY = "phd-hub-demo-db-v1";
const IMG = "phd-hub-demo-img:";

function read(): Snapshot {
  let raw: Partial<Snapshot> = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { /* empty */ }
  const snap = { settings: normalizeSettings(raw.settings) } as Snapshot;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of TABLES) (snap as any)[t] = ((raw as any)[t] ?? []).map((r: any) => (NORMALIZERS[t] as any)(r));
  return snap;
}
function write(s: Snapshot) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export class DemoBackend implements Backend {
  readonly kind = "demo" as const;

  async loadAll() { return read(); }

  async apply(op: SyncOp) {
    const s = read();
    if (op.kind === "settings") {
      s.settings = normalizeSettings({ ...s.settings, ...op.patch });
    } else if (op.kind === "upsert") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (s as any)[op.table] as { id: string }[];
      for (const r of op.rows) {
        const i = list.findIndex((x) => x.id === r.id);
        if (i >= 0) list[i] = { ...list[i], ...r } as { id: string };
        else list.push(r as { id: string });
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s as any)[op.table] = (s as any)[op.table].filter((r: { id: string }) => !op.ids.includes(r.id));
    }
    write(s);
  }

  async importSnapshot(data: Partial<Snapshot>, mode: "replace" | "merge", backupId: string | null) {
    const s = mode === "replace" ? ({ ...read(), ...Object.fromEntries(TABLES.map((t) => [t, []])) } as Snapshot) : read();
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list = (s as any)[t] as { id: string }[];
      const ids = new Set(list.map((r) => r.id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const incoming = ((data as any)[t] ?? []) as { id: string }[];
      const add = incoming.filter((r) => !ids.has(r.id));
      list.push(...add);
      counts[t] = add.length;
    }
    if (data.settings) {
      const { background: _b, avatar_path: _a, imported_backup_ids: _i, ...rest } = data.settings;
      s.settings = normalizeSettings({ ...s.settings, ...rest });
    }
    if (backupId) s.settings.imported_backup_ids = [...s.settings.imported_backup_ids.filter((x) => x !== backupId), backupId];
    write(s);
    return counts;
  }

  async uploadImage(kind: ImageKind, blob: Blob) {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blob);
    });
    const path = `demo/${kind}/${uid()}`;
    try { localStorage.setItem(IMG + path, dataUrl); }
    catch { throw new Error("Browser storage is full. Demo mode keeps images in this browser only."); }
    return path;
  }
  async deleteImage(path: string) { localStorage.removeItem(IMG + path); }
  async signedUrls(paths: string[]) {
    const out: Record<string, string> = {};
    for (const p of paths) { const v = localStorage.getItem(IMG + p); if (v) out[p] = v; }
    return out;
  }
  subscribe(onRemoteChange: () => void) {
    const h = (e: StorageEvent) => { if (e.key === KEY) onRemoteChange(); };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }
}
