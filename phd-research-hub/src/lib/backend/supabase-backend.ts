import type { SupabaseClient } from "@supabase/supabase-js";
import { NORMALIZERS, normalizeSettings, toDbRow } from "../factories";
import { TABLES, type Snapshot, type TableName, type UserSettings } from "../types";
import { uid } from "../utils";
import type { Backend, ImageKind, SyncOp } from "./types";

const BUCKET = "user-media";

export class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;
  private urlCache = new Map<string, { url: string; exp: number }>();

  constructor(private sb: SupabaseClient, private userId: string) {}

  private async all(table: TableName) {
    // Page through results so large tables are never silently truncated.
    const out: Record<string, unknown>[] = [];
    const size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await this.sb.from(table).select("*").range(from, from + size - 1);
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < size) break;
    }
    return out;
  }

  async loadAll(): Promise<Snapshot> {
    const results = await Promise.all(TABLES.map((t) => this.all(t)));
    const { data: settingsRow, error } = await this.sb
      .from("user_settings").select("*").eq("user_id", this.userId).maybeSingle();
    if (error) throw error;
    if (!settingsRow) {
      const { error: insErr } = await this.sb.from("user_settings").insert({ user_id: this.userId });
      if (insErr && insErr.code !== "23505") throw insErr;
    }
    const snap = { settings: normalizeSettings(settingsRow as Partial<UserSettings> | null) } as Snapshot;
    TABLES.forEach((t, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (snap as any)[t] = results[i].map((r) => (NORMALIZERS[t] as any)(r));
    });
    return snap;
  }

  async apply(op: SyncOp): Promise<void> {
    if (op.kind === "upsert") {
      const rows = op.rows.map(toDbRow);
      const { error } = await this.sb.from(op.table).upsert(rows, { onConflict: "id" });
      if (error) throw error;
    } else if (op.kind === "delete") {
      const { error } = await this.sb.from(op.table).delete().in("id", op.ids);
      if (error) throw error;
    } else {
      const patch = { ...op.patch } as Record<string, unknown>;
      delete patch.user_id; delete patch.created_at; delete patch.updated_at;
      const { error } = await this.sb.from("user_settings")
        .upsert({ user_id: this.userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    }
  }

  async importSnapshot(data: Partial<Snapshot>, mode: "replace" | "merge", backupId: string | null) {
    const { data: res, error } = await this.sb.rpc("import_snapshot", {
      p_data: data, p_mode: mode, p_backup_id: backupId,
    });
    if (error) throw error;
    return (res ?? {}) as Record<string, number>;
  }

  async uploadImage(kind: ImageKind, blob: Blob): Promise<string> {
    const ext = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp";
    const path = `${this.userId}/${kind}/${uid()}.${ext}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type, cacheControl: "31536000", upsert: false,
    });
    if (error) throw error;
    return path;
  }

  async deleteImage(path: string) {
    if (!path.startsWith(this.userId + "/")) return;
    const { error } = await this.sb.storage.from(BUCKET).remove([path]);
    if (error) throw error;
    this.urlCache.delete(path);
  }

  async signedUrls(paths: string[]) {
    const now = Date.now();
    const out: Record<string, string> = {};
    const missing: string[] = [];
    for (const p of paths) {
      const c = this.urlCache.get(p);
      if (c && c.exp > now + 60_000) out[p] = c.url;
      else missing.push(p);
    }
    if (missing.length) {
      const ttl = 60 * 60 * 6; // 6h
      const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrls(missing, ttl);
      if (error) throw error;
      for (const d of data ?? []) {
        if (d.signedUrl && d.path) {
          out[d.path] = d.signedUrl;
          this.urlCache.set(d.path, { url: d.signedUrl, exp: now + ttl * 1000 });
        }
      }
    }
    return out;
  }

  subscribe(onRemoteChange: () => void) {
    const ch = this.sb.channel(`hub-${this.userId}-${uid()}`);
    for (const t of [...TABLES, "user_settings"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t, filter: `user_id=eq.${this.userId}` }, () =>
        onRemoteChange());
    }
    ch.subscribe();
    return () => { this.sb.removeChannel(ch); };
  }
}
