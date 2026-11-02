// Pure derivations over store data. No stored counters: every number in the UI
// is computed from the current rows.
import { DEFAULT_PHASES, DEFAULT_STATUSES, PRIORITY_RANK } from "./constants";
import type {
  Milestone, PhaseDef, PipelineStage, Project, StatusDef, StatusKind, Task, TaskDependency, UserSettings, WaitingItem,
} from "./types";
import { daysUntil, todayStr } from "./utils";

export const phasesOf = (s: UserSettings): PhaseDef[] => s.phases ?? DEFAULT_PHASES;
export const statusesOf = (s: UserSettings): StatusDef[] => s.project_statuses ?? DEFAULT_STATUSES;

export function phaseLabel(s: UserSettings, key: string) {
  return phasesOf(s).find((p) => p.key === key)?.label ?? key;
}
export function phaseStage(s: UserSettings, key: string): PipelineStage {
  return phasesOf(s).find((p) => p.key === key)?.stage ?? "idea";
}
export function statusDef(s: UserSettings, key: string): StatusDef {
  return statusesOf(s).find((x) => x.key === key) ?? { key, label: key, kind: "active" };
}
export const statusKind = (s: UserSettings, key: string): StatusKind => statusDef(s, key).kind;

export const isOpenTask = (t: Task) => t.status !== "done" && t.status !== "cancelled";

export function unmetDependencies(task: Task, deps: TaskDependency[], tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return deps
    .filter((d) => d.task_id === task.id)
    .map((d) => byId.get(d.depends_on_id))
    .filter((t): t is Task => !!t && isOpenTask(t));
}

/** Overdue = past due AND actionable. Tasks waiting on someone else are not "late". */
export function isTaskOverdue(t: Task): boolean {
  if (!isOpenTask(t) || t.status === "waiting" || !t.due_date) return false;
  return t.due_date < todayStr();
}

/** A project is only "behind schedule" when the delay is in my hands. */
export function isProjectOverdue(p: Project, s: UserSettings): boolean {
  const kind = statusKind(s, p.status);
  if (!p.target_date || ["completed", "archived", "waiting"].includes(kind)) return false;
  return p.target_date < todayStr();
}

export interface Progress {
  value: number; // 0–100
  source: "manual" | "work" | "phase";
  tasksDone: number;
  tasksTotal: number;
  milestonesDone: number;
  milestonesTotal: number;
}

/**
 * Estimated progress. Research is not linear, so this is explicitly an estimate:
 * - a manual override always wins;
 * - otherwise tasks and milestones are blended (milestones weighted higher, as
 *   they represent meaningful research outputs);
 * - with no tracked work yet, the research phase gives a rough baseline.
 */
export function projectProgress(p: Project, tasks: Task[], milestones: Milestone[], s: UserSettings): Progress {
  const pt = tasks.filter((t) => t.project_id === p.id && t.status !== "cancelled");
  const pm = milestones.filter((m) => m.project_id === p.id);
  const tasksDone = pt.filter((t) => t.status === "done").length;
  const milestonesDone = pm.filter((m) => !!m.completed_on).length;
  const base = { tasksDone, tasksTotal: pt.length, milestonesDone, milestonesTotal: pm.length };
  if (p.progress_override !== null && p.progress_override !== undefined) {
    return { ...base, value: p.progress_override, source: "manual" };
  }
  if (pt.length || pm.length) {
    const tr = pt.length ? tasksDone / pt.length : null;
    const mr = pm.length ? milestonesDone / pm.length : null;
    const v = tr !== null && mr !== null ? tr * 0.4 + mr * 0.6 : (tr ?? mr ?? 0);
    return { ...base, value: Math.round(v * 100), source: "work" };
  }
  const phases = phasesOf(s);
  const idx = Math.max(0, phases.findIndex((x) => x.key === p.phase));
  const v = statusKind(s, p.status) === "completed" ? 100 : Math.round((idx / Math.max(1, phases.length)) * 100);
  return { ...base, value: v, source: "phase" };
}

const statusRank: Record<string, number> = { in_progress: 0, next: 1, inbox: 2, blocked: 3, waiting: 4 };

export function sortByImportance(a: Task, b: Task) {
  const ao = isTaskOverdue(a) ? 0 : 1, bo = isTaskOverdue(b) ? 0 : 1;
  if (ao !== bo) return ao - bo;
  const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (pr) return pr;
  const ad = a.due_date ?? "9999", bd = b.due_date ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return a.sort_order - b.sort_order;
}

export function sortByDue(a: Task, b: Task) {
  const ad = a.due_date ?? "9999", bd = b.due_date ?? "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
}

/** Next actionable task: open, not waiting, dependencies satisfied. */
export function nextActionable(projectId: string, tasks: Task[], deps: TaskDependency[]): Task | null {
  const cands = tasks.filter((t) =>
    t.project_id === projectId && ["inbox", "next", "in_progress"].includes(t.status) &&
    unmetDependencies(t, deps, tasks).length === 0);
  cands.sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || sortByImportance(a, b));
  return cands[0] ?? null;
}

export function waitingActive(w: WaitingItem) {
  return w.status === "waiting" || w.status === "followed_up";
}
export function followUpState(w: WaitingItem): "overdue" | "this_week" | "later" | "none" {
  if (!waitingActive(w) || !w.follow_up_on) return "none";
  const n = daysUntil(w.follow_up_on)!;
  if (n < 0) return "overdue";
  if (n <= 7) return "this_week";
  return "later";
}

/** Next deadline for a project: its target date or the nearest open milestone. */
export function projectNextDeadline(p: Project, milestones: Milestone[]): { date: string; label: string } | null {
  const opts: { date: string; label: string }[] = [];
  if (p.target_date) opts.push({ date: p.target_date, label: "Target completion" });
  for (const m of milestones) if (m.project_id === p.id && !m.completed_on && m.due_date) opts.push({ date: m.due_date, label: m.title });
  const today = todayStr();
  const upcoming = opts.filter((o) => o.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (upcoming[0]) return upcoming[0];
  return opts.sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
}
