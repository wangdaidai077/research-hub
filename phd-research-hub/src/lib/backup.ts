"use client";
import { NORMALIZERS, normalizeSettings } from "./factories";
import { phaseLabel, projectProgress, statusDef } from "./selectors";
import { useStore } from "./store";
import { TABLES, type BackupFile, type Snapshot } from "./types";
import { downloadFile, nowISO, toCSV, todayStr, uid } from "./utils";

export function buildBackup(): BackupFile {
  const s = useStore.getState();
  const data = {} as Snapshot;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of TABLES) (data as any)[t] = (s[t] as any[]).map(({ user_id: _u, ...r }) => r);
  const { user_id: _u, ...settings } = s.settings;
  return {
    format: "phd-research-hub-backup", version: 1, backup_id: uid(), exported_at: nowISO(),
    ...data, settings: settings as Snapshot["settings"],
  };
}

export function exportJSON() {
  const b = buildBackup();
  downloadFile(`research-hub-backup-${todayStr()}.json`, JSON.stringify(b, null, 2), "application/json");
  return b;
}

export interface ParsedBackup { file: BackupFile; counts: Record<string, number>; alreadyImported: boolean }

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  const r = raw as Partial<BackupFile>;
  if (!r || typeof r !== "object" || r.format !== "phd-research-hub-backup") throw new Error("This is not a Research Hub backup file.");
  if (r.version !== 1) throw new Error(`Unsupported backup version: ${String(r.version)}`);
  const file = { ...r } as BackupFile;
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = Array.isArray((r as any)[t]) ? ((r as any)[t] as any[]) : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (file as any)[t] = rows.filter((x) => x && typeof x.id === "string").map((x) => (NORMALIZERS[t] as any)(x));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    counts[t] = (file as any)[t].length;
  }
  // Keep only references that resolve inside the file, so relations restore cleanly.
  const pids = new Set(file.projects.map((p) => p.id));
  const tids = new Set(file.tasks.map((t) => t.id));
  const mids = new Set(file.milestones.map((m) => m.id));
  file.milestones = file.milestones.filter((m) => pids.has(m.project_id));
  file.tasks = file.tasks.map((t) => ({
    ...t,
    project_id: t.project_id && pids.has(t.project_id) ? t.project_id : null,
    parent_id: t.parent_id && tids.has(t.parent_id) ? t.parent_id : null,
    milestone_id: t.milestone_id && mids.has(t.milestone_id) ? t.milestone_id : null,
  }));
  file.task_dependencies = file.task_dependencies.filter((d) => tids.has(d.task_id) && tids.has(d.depends_on_id));
  file.waiting_items = file.waiting_items.map((w) => ({
    ...w, project_id: w.project_id && pids.has(w.project_id) ? w.project_id : null, task_id: w.task_id && tids.has(w.task_id) ? w.task_id : null,
  }));
  file.ideas = file.ideas.map((i) => ({ ...i, linked_project_id: i.linked_project_id && pids.has(i.linked_project_id) ? i.linked_project_id : null }));
  file.activity_log = file.activity_log.map((a) => ({ ...a, project_id: a.project_id && pids.has(a.project_id) ? a.project_id : null }));
  file.settings = normalizeSettings(r.settings);
  const already = useStore.getState().settings.imported_backup_ids.includes(String(r.backup_id));
  return { file, counts, alreadyImported: already };
}

export async function importBackup(parsed: ParsedBackup, mode: "replace" | "merge") {
  const st = useStore.getState();
  if (!st.backend) throw new Error("Not connected");
  if (st.queue.length) await st.flush();
  if (useStore.getState().queue.length) throw new Error("Some changes have not been saved yet. Resolve the sync issue first.");
  const payload: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of TABLES) payload[t] = (parsed.file as any)[t].map(({ user_id: _u, ...r }: any) => r);
  const { background: _b, avatar_path: _a, imported_backup_ids: _i, user_id: _u, ...settings } = parsed.file.settings;
  payload.settings = settings;
  const res = await st.backend.importSnapshot(payload as Partial<Snapshot>, mode, parsed.file.backup_id ?? null);
  await useStore.getState().reload(true);
  return res;
}

export function exportProjectsCSV() {
  const s = useStore.getState();
  const rows = s.projects.map((p) => ({
    ...p,
    phase: phaseLabel(s.settings, p.phase),
    status: statusDef(s.settings, p.status).label,
    estimated_progress: projectProgress(p, s.tasks, s.milestones, s.settings).value,
    links: p.links.map((l) => `${l.label} <${l.url}>`).join("; "),
    open_tasks: s.tasks.filter((t) => t.project_id === p.id && t.status !== "done" && t.status !== "cancelled").length,
  }));
  const cols = ["id", "title", "research_question", "description", "category", "collaborators", "phase", "status", "priority",
    "start_date", "target_date", "estimated_progress", "progress_override", "open_tasks", "links", "notes", "last_activity_at", "created_at", "updated_at"];
  downloadFile(`research-projects-${todayStr()}.csv`, "﻿" + toCSV(rows as unknown as Record<string, unknown>[], cols), "text/csv;charset=utf-8");
}

export function exportTasksCSV() {
  const s = useStore.getState();
  const pname = new Map(s.projects.map((p) => [p.id, p.title]));
  const mname = new Map(s.milestones.map((m) => [m.id, m.title]));
  const tname = new Map(s.tasks.map((t) => [t.id, t.title]));
  const rows = s.tasks.map((t) => ({
    ...t,
    project: t.project_id ? pname.get(t.project_id) ?? "" : "",
    milestone: t.milestone_id ? mname.get(t.milestone_id) ?? "" : "",
    parent_task: t.parent_id ? tname.get(t.parent_id) ?? "" : "",
    depends_on: s.task_dependencies.filter((d) => d.task_id === t.id).map((d) => tname.get(d.depends_on_id)).filter(Boolean).join("; "),
  }));
  const cols = ["id", "title", "project", "parent_task", "milestone", "status", "priority", "cognitive_load", "due_date", "scheduled_date",
    "effort_hours", "actual_hours", "recurrence", "depends_on", "description", "notes", "completed_at", "created_at", "updated_at"];
  downloadFile(`research-tasks-${todayStr()}.csv`, "﻿" + toCSV(rows as unknown as Record<string, unknown>[], cols), "text/csv;charset=utf-8");
}
