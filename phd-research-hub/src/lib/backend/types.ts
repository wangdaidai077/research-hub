import type { Snapshot, TableName, UserSettings } from "../types";

export type SyncOp =
  | { opId: string; kind: "upsert"; table: TableName; rows: Record<string, unknown>[] }
  | { opId: string; kind: "delete"; table: TableName; ids: string[] }
  | { opId: string; kind: "settings"; patch: Partial<UserSettings> };

export type ImageKind = "background" | "cover" | "icon" | "avatar";

/**
 * The storage boundary. The UI never talks to Supabase directly — only to this
 * interface — so the persistence layer can be swapped or extended later.
 */
export interface Backend {
  readonly kind: "supabase" | "demo";
  loadAll(): Promise<Snapshot>;
  apply(op: SyncOp): Promise<void>;
  importSnapshot(data: Partial<Snapshot>, mode: "replace" | "merge", backupId: string | null): Promise<Record<string, number>>;
  uploadImage(kind: ImageKind, blob: Blob): Promise<string>;
  deleteImage(path: string): Promise<void>;
  signedUrls(paths: string[]): Promise<Record<string, string>>;
  subscribe(onRemoteChange: () => void): () => void;
}
