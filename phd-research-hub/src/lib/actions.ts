"use client";
// Domain operations. Each one edits existing rows in place (no duplicates) and
// keeps related records consistent.
import { addDays, addMonths, addWeeks } from "date-fns";
import { newIdea, newMilestone, newProject, newTask, newWaiting, normalizeActivity, normalizeDependency, normalizeWeekly } from "./factories";
import { useStore } from "./store";
import type { Idea, Milestone, Project, Task, TaskStatus, WaitingItem, WeeklyPlan } from "./types";
import { nowISO, parseDate, toDateStr, todayStr, uid } from "./utils";
import { phaseLabel, statusDef } from "./selectors";

const st = () => useStore.getState();

export function logActivity(project_id: string | null, kind: string, message: string) {
  st().upsert("activity_log", normalizeActivity({ project_id, kind, message }));
  if (project_id) {
    const p = st().projects.find((x) => x.id === project_id);
    if (p) st().upsert("projects", { ...p, last_activity_at: nowISO() });
  }
}

// ---------- projects ----------
export function createProject(data: Partial<Project>): Project {
  const p = newProject(data);
  st().upsert("projects", p);
  logActivity(p.id, "project", `Created project “${p.title}”`);
  return p;
}

export function updateProject(id: string, patch: Partial<Project>, opts: { log?: boolean } = {}) {
  const p = st().projects.find((x) => x.id === id);
  if (!p) return;
  const next = { ...p, ...patch, last_activity_at: nowISO() };
  st().upsert("projects", next);
  if (opts.log !== false) {
    const s = st().settings;
    if (patch.phase && patch.phase !== p.phase)
      logActivity(id, "phase", `Phase: ${phaseLabel(s, p.phase)} → ${phaseLabel(s, patch.phase)}`);
    if (patch.status && patch.status !== p.status)
      logActivity(id, "status", `Status: ${statusDef(s, p.status).label} → ${statusDef(s, patch.status).label}`);
    if (patch.progress_override !== undefined && patch.progress_override !== p.progress_override)
      logActivity(id, "progress", patch.progress_override === null
        ? "Progress estimate reset to automatic"
        : `Progress estimate set to ${patch.progress_override}%`);
  }
}

export function deleteProject(id: string) {
  const p = st().projects.find((x) => x.id === id);
  if (!p) return;
  for (const path of [p.cover_path, p.icon_path]) if (path) st().backend?.deleteImage(path).catch(() => {});
  st().remove("projects", id);
}

// ---------- tasks ----------
export function createTask(data: Partial<Task>): Task {
  const t = newTask(data);
  st().upsert("tasks", t);
  if (t.project_id) logActivity(t.project_id, "task", `Added task “${t.title}”`);
  return t;
}

function nextOccurrence(date: string | null, rec: Task["recurrence"]): string | null {
  const d = parseDate(date) ?? new Date();
  switch (rec) {
    case "daily": return toDateStr(addDays(d, 1));
    case "weekly": return toDateStr(addWeeks(d, 1));
    case "biweekly": return toDateStr(addWeeks(d, 2));
    case "monthly": return toDateStr(addMonths(d, 1));
    default: return null;
  }
}

export function updateTask(id: string, patch: Partial<Task>) {
  const t = st().tasks.find((x) => x.id === id);
  if (!t) return;
  const next: Task = { ...t, ...patch };
  if (patch.status && patch.status !== t.status) {
    if (patch.status === "done") next.completed_at = nowISO();
    else if (t.status === "done") next.completed_at = null;
  }
  st().upsert("tasks", next);

  if (patch.status && patch.status !== t.status) {
    if (patch.status === "done") {
      if (t.project_id) logActivity(t.project_id, "task_done", `Completed “${t.title}”`);
      // Recurring tasks: the finished instance stays as history, the next one is scheduled.
      if (t.recurrence !== "none") {
        const due = nextOccurrence(t.due_date ?? t.scheduled_date, t.recurrence);
        const sched = t.scheduled_date ? nextOccurrence(t.scheduled_date, t.recurrence) : null;
        st().upsert("tasks", newTask({
          ...t, id: uid(), status: "next", completed_at: null, due_date: t.due_date ? due : null,
          scheduled_date: sched, actual_hours: null, created_at: nowISO(),
        }));
      }
    } else if (t.project_id) {
      const p = st().projects.find((x) => x.id === t.project_id);
      if (p) st().upsert("projects", { ...p, last_activity_at: nowISO() });
    }
  }
}

export const setTaskStatus = (id: string, status: TaskStatus) => updateTask(id, { status });
export const toggleTaskDone = (t: Task) => updateTask(t.id, { status: t.status === "done" ? "next" : "done" });

export function deleteTask(id: string) {
  st().remove("tasks", id);
}

export function addDependency(taskId: string, dependsOnId: string): string | null {
  if (taskId === dependsOnId) return "A task cannot depend on itself.";
  const deps = st().task_dependencies;
  if (deps.some((d) => d.task_id === taskId && d.depends_on_id === dependsOnId)) return "That dependency already exists.";
  // reject cycles
  const graph = new Map<string, string[]>();
  for (const d of deps) graph.set(d.task_id, [...(graph.get(d.task_id) ?? []), d.depends_on_id]);
  const stack = [dependsOnId];
  const seen = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === taskId) return "That would create a circular dependency.";
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(graph.get(n) ?? []));
  }
  st().upsert("task_dependencies", normalizeDependency({ task_id: taskId, depends_on_id: dependsOnId }));
  return null;
}
export const removeDependency = (depId: string) => st().remove("task_dependencies", depId);

/** Move every unfinished task scheduled in [from, to] to a new date (updates, never copies). */
export function rescheduleTasks(ids: string[], date: string | null) {
  const rows = st().tasks.filter((t) => ids.includes(t.id)).map((t) => ({ ...t, scheduled_date: date }));
  if (rows.length) st().upsert("tasks", rows);
}

// ---------- milestones ----------
export function createMilestone(data: Partial<Milestone> & { project_id: string }) {
  const m = newMilestone(data);
  st().upsert("milestones", m);
  logActivity(m.project_id, "milestone", `Added milestone “${m.title}”`);
  return m;
}
export function updateMilestone(id: string, patch: Partial<Milestone>) {
  const m = st().milestones.find((x) => x.id === id);
  if (!m) return;
  st().upsert("milestones", { ...m, ...patch });
  if (patch.completed_on && !m.completed_on) logActivity(m.project_id, "milestone_done", `Milestone reached: “${m.title}”`);
}
export const deleteMilestone = (id: string) => st().remove("milestones", id);

// ---------- waiting items ----------
export function createWaiting(data: Partial<WaitingItem>, opts: { markTaskWaiting?: boolean } = {}) {
  const w = newWaiting(data);
  st().upsert("waiting_items", w);
  if (w.task_id && opts.markTaskWaiting !== false) {
    const t = st().tasks.find((x) => x.id === w.task_id);
    if (t && t.status !== "done") st().upsert("tasks", { ...t, status: "waiting" });
  }
  if (w.project_id) logActivity(w.project_id, "waiting", `Waiting on ${w.waiting_for}`);
  return w;
}
export function updateWaiting(id: string, patch: Partial<WaitingItem>) {
  const w = st().waiting_items.find((x) => x.id === id);
  if (w) st().upsert("waiting_items", { ...w, ...patch });
}
/** Resolve an external dependency and return the related task to an actionable state. */
export function resolveWaiting(id: string, opts: { reactivateTask?: boolean } = {}) {
  const w = st().waiting_items.find((x) => x.id === id);
  if (!w) return;
  st().upsert("waiting_items", { ...w, status: "resolved", resolved_at: nowISO() });
  if (w.task_id && opts.reactivateTask !== false) {
    const t = st().tasks.find((x) => x.id === w.task_id);
    const stillWaiting = st().waiting_items.some((o) => o.id !== w.id && o.task_id === w.task_id && (o.status === "waiting" || o.status === "followed_up"));
    if (t && t.status === "waiting" && !stillWaiting) st().upsert("tasks", { ...t, status: "next" });
  }
  if (w.project_id) logActivity(w.project_id, "waiting_resolved", `Received: ${w.waiting_for}`);
}
export function logFollowUp(id: string, nextDate: string | null) {
  const w = st().waiting_items.find((x) => x.id === id);
  if (!w) return;
  const note = `Followed up ${todayStr()}`;
  st().upsert("waiting_items", {
    ...w, status: "followed_up", follow_up_on: nextDate,
    notes: w.notes ? `${w.notes}\n${note}` : note,
  });
}
export const deleteWaiting = (id: string) => st().remove("waiting_items", id);

// ---------- ideas ----------
export function createIdea(data: Partial<Idea>) {
  const i = newIdea(data);
  st().upsert("ideas", i);
  return i;
}
export function updateIdea(id: string, patch: Partial<Idea>) {
  const i = st().ideas.find((x) => x.id === id);
  if (i) st().upsert("ideas", { ...i, ...patch });
}
export const deleteIdea = (id: string) => st().remove("ideas", id);

export function promoteIdea(id: string): Project | null {
  const i = st().ideas.find((x) => x.id === id);
  if (!i) return null;
  const notes = [
    i.description,
    i.theory && `Theoretical relevance: ${i.theory}`,
    i.literature && `Related literature: ${i.literature}`,
    i.data_sources && `Potential data sources: ${i.data_sources}`,
    i.notes,
  ].filter(Boolean).join("\n\n");
  const p = createProject({
    title: i.title, research_question: i.question, description: i.description,
    category: i.tags[0] ?? null, notes: notes || null, phase: "idea", status: "backlog", idea_id: i.id,
    start_date: todayStr(),
  });
  st().upsert("ideas", { ...i, status: "promoted", linked_project_id: p.id });
  logActivity(p.id, "idea", `Promoted from idea backlog`);
  return p;
}

// ---------- weekly plans ----------
export function getOrCreateWeek(weekStart: string): WeeklyPlan {
  const existing = st().weekly_plans.find((w) => w.week_start === weekStart);
  if (existing) return existing;
  return normalizeWeekly({ week_start: weekStart });
}
export function saveWeek(weekStart: string, patch: Partial<WeeklyPlan>) {
  const w = getOrCreateWeek(weekStart);
  st().upsert("weekly_plans", { ...w, ...patch });
}
