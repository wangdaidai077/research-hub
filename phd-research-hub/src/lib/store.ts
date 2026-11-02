"use client";
// Single source of truth on the client. Every view reads from this store, so
// completing a task anywhere updates it everywhere. Writes are applied
// optimistically, then pushed to the backend through a persistent queue:
// a failed request is retried — never silently discarded.
import { create } from "zustand";
import type { Backend, SyncOp } from "./backend/types";
import { normalizeSettings } from "./factories";
import { TABLES, type RowMap, type Snapshot, type TableName, type UserSettings } from "./types";
import { nowISO, uid } from "./utils";

export type SyncState = "idle" | "loading" | "saving" | "saved" | "offline" | "error";

type Data = { [K in TableName]: RowMap[K][] } & { settings: UserSettings };

interface Store extends Data {
  ready: boolean;
  backend: Backend | null;
  userId: string | null;
  sync: SyncState;
  syncError: string | null;
  queue: SyncOp[];
  lastSyncedAt: string | null;
  init(backend: Backend, userId: string): Promise<void>;
  reload(force?: boolean): Promise<void>;
  upsert<K extends TableName>(table: K, rows: RowMap[K] | RowMap[K][]): void;
  remove(table: TableName, ids: string | string[]): void;
  updateSettings(patch: Partial<UserSettings>): void;
  flush(): Promise<void>;
  discardQueue(): void;
  replaceAll(s: Snapshot): void;
}

const emptyData = (): Data => ({
  projects: [], milestones: [], tasks: [], task_dependencies: [], waiting_items: [],
  ideas: [], weekly_plans: [], activity_log: [], settings: normalizeSettings(null),
});

const queueKey = (u: string) => `phd-hub-queue:${u}`;
const persistQueue = (u: string | null, q: SyncOp[]) => {
  if (!u) return;
  try { localStorage.setItem(queueKey(u), JSON.stringify(q)); } catch { /* quota */ }
};

let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;
let savedTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<Store>((set, get) => ({
  ...emptyData(),
  ready: false,
  backend: null,
  userId: null,
  sync: "idle",
  syncError: null,
  queue: [],
  lastSyncedAt: null,

  async init(backend, userId) {
    let queue: SyncOp[] = [];
    try { queue = JSON.parse(localStorage.getItem(queueKey(userId)) || "[]"); } catch { queue = []; }
    set({ backend, userId, queue, sync: "loading" });
    // Push any edits that did not reach the server last time *before* loading.
    if (queue.length) await get().flush();
    await get().reload(true);
    set({ ready: true });
  },

  async reload(force = false) {
    const { backend, queue } = get();
    if (!backend) return;
    if (!force && (queue.length || flushing)) return; // never overwrite unsynced local edits
    try {
      if (force) set({ sync: get().ready ? get().sync : "loading" });
      const snap = await backend.loadAll();
      if (get().queue.length && !force) return;
      // Re-apply any still-pending local edits on top of fresh server data.
      const merged = applyPending(snap, get().queue);
      set({ ...merged, sync: get().queue.length ? get().sync : "saved", syncError: null, lastSyncedAt: nowISO() });
    } catch (e) {
      set({ sync: navigator.onLine ? "error" : "offline", syncError: errMsg(e) });
    }
  },

  replaceAll(s) {
    set({ ...s });
  },

  upsert(table, rows) {
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, updated_at: nowISO() }));
    set((st) => {
      const cur = st[table] as { id: string }[];
      const byId = new Map(cur.map((r) => [r.id, r]));
      for (const r of list) byId.set(r.id, r);
      return { [table]: Array.from(byId.values()) } as Partial<Store>;
    });
    enqueue({ opId: uid(), kind: "upsert", table, rows: list as unknown as Record<string, unknown>[] });
  },

  remove(table, ids) {
    const idList = Array.isArray(ids) ? ids : [ids];
    set((st) => cascadeLocal(st, table, new Set(idList)) as Partial<Store>);
    enqueue({ opId: uid(), kind: "delete", table, ids: idList });
  },

  updateSettings(patch) {
    set((st) => ({ settings: normalizeSettings({ ...st.settings, ...patch }) }));
    enqueue({ opId: uid(), kind: "settings", patch });
  },

  async flush() {
    const { backend } = get();
    if (!backend || flushing) return;
    flushing = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    try {
      while (get().queue.length) {
        set({ sync: "saving" });
        const op = get().queue[0];
        try {
          await backend.apply(op);
        } catch (e) {
          const offline = typeof navigator !== "undefined" && !navigator.onLine;
          set({ sync: offline ? "offline" : "error", syncError: errMsg(e) });
          retryTimer = setTimeout(() => get().flush(), retryDelay);
          retryDelay = Math.min(retryDelay * 2, 60_000);
          return;
        }
        retryDelay = 2000;
        const rest = get().queue.filter((q) => q.opId !== op.opId);
        set({ queue: rest });
        persistQueue(get().userId, rest);
      }
      set({ sync: "saved", syncError: null, lastSyncedAt: nowISO() });
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => { if (get().sync === "saved") set({ sync: "idle" }); }, 2500);
    } finally {
      flushing = false;
    }
  },

  discardQueue() {
    set({ queue: [] });
    persistQueue(get().userId, []);
    get().reload(true);
  },
}));

function enqueue(op: SyncOp) {
  const st = useStore.getState();
  let q = [...st.queue];
  // Coalesce consecutive edits of the same single row (e.g. typing in notes).
  const last = q[q.length - 1];
  if (!flushing && last && last.kind === "upsert" && op.kind === "upsert" && last.table === op.table &&
      last.rows.length === 1 && op.rows.length === 1 && last.rows[0].id === op.rows[0].id) {
    q[q.length - 1] = { ...op };
  } else if (!flushing && last && last.kind === "settings" && op.kind === "settings") {
    q[q.length - 1] = { ...op, patch: { ...last.patch, ...op.patch } };
  } else {
    q = [...q, op];
  }
  useStore.setState({ queue: q, sync: "saving" });
  persistQueue(st.userId, q);
  queueMicrotask(() => useStore.getState().flush());
}

function applyPending(snap: Snapshot, queue: SyncOp[]): Data {
  const d = { ...snap } as Data;
  for (const op of queue) {
    if (op.kind === "settings") d.settings = normalizeSettings({ ...d.settings, ...op.patch });
    else if (op.kind === "upsert") {
      const m = new Map((d[op.table] as { id: string }[]).map((r) => [r.id, r]));
      for (const r of op.rows) m.set(r.id as string, r as { id: string });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d as any)[op.table] = Array.from(m.values());
    } else Object.assign(d, cascadeLocal(d, op.table, new Set(op.ids)));
  }
  return d;
}

/** Mirror the database's ON DELETE CASCADE / SET NULL rules in memory. */
function cascadeLocal(st: Data, table: TableName, ids: Set<string>): Partial<Data> {
  const out: Partial<Data> = {};
  let projects = st.projects, tasks = st.tasks, milestones = st.milestones;
  let deps = st.task_dependencies, waiting = st.waiting_items, ideas = st.ideas, activity = st.activity_log;
  const removedTasks = new Set<string>();

  if (table === "projects") {
    projects = projects.filter((p) => !ids.has(p.id));
    tasks.forEach((t) => { if (t.project_id && ids.has(t.project_id)) removedTasks.add(t.id); });
    milestones = milestones.filter((m) => !ids.has(m.project_id));
    waiting = waiting.filter((w) => !(w.project_id && ids.has(w.project_id)));
    activity = activity.filter((a) => !(a.project_id && ids.has(a.project_id)));
    ideas = ideas.map((i) => (i.linked_project_id && ids.has(i.linked_project_id) ? { ...i, linked_project_id: null } : i));
  } else if (table === "tasks") {
    ids.forEach((i) => removedTasks.add(i));
  } else if (table === "milestones") {
    milestones = milestones.filter((m) => !ids.has(m.id));
    tasks = tasks.map((t) => (t.milestone_id && ids.has(t.milestone_id) ? { ...t, milestone_id: null } : t));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[table] = (st[table] as { id: string }[]).filter((r) => !ids.has(r.id));
    return out;
  }

  // subtasks cascade recursively
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) if (t.parent_id && removedTasks.has(t.parent_id) && !removedTasks.has(t.id)) { removedTasks.add(t.id); grew = true; }
  }
  if (removedTasks.size) {
    tasks = tasks.filter((t) => !removedTasks.has(t.id));
    deps = deps.filter((d) => !removedTasks.has(d.task_id) && !removedTasks.has(d.depends_on_id));
    waiting = waiting.map((w) => (w.task_id && removedTasks.has(w.task_id) ? { ...w, task_id: null } : w));
  }
  return { projects, tasks, milestones, task_dependencies: deps, waiting_items: waiting, ideas, activity_log: activity };
}

function errMsg(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Request failed";
}

export const getData = () => useStore.getState();
export { TABLES };
