// Row factories + normalisers. Every row that enters the store (new, fetched or
// imported) passes through here, so missing fields always get safe defaults.
import { DEFAULT_SETTINGS } from "./constants";
import type {
  ActivityEntry, Idea, Milestone, Project, RowMap, TableName, Task, TaskDependency, UserSettings, WaitingItem, WeeklyPlan,
} from "./types";
import { nowISO, todayStr, uid } from "./utils";

const base = () => ({ id: uid(), created_at: nowISO(), updated_at: nowISO() });
const s = (v: unknown): string | null => (typeof v === "string" && v.length ? v : v == null ? null : String(v));
const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function newProject(p: Partial<Project> = {}): Project {
  return normalizeProject({ ...base(), last_activity_at: nowISO(), ...p });
}
export function normalizeProject(p: Partial<Project>): Project {
  return {
    id: p.id ?? uid(),
    title: (p.title ?? "Untitled project").toString(),
    research_question: s(p.research_question),
    description: s(p.description),
    category: s(p.category),
    collaborators: s(p.collaborators),
    start_date: s(p.start_date),
    target_date: s(p.target_date),
    priority: p.priority ?? "medium",
    phase: p.phase ?? "idea",
    status: p.status ?? "backlog",
    notes: s(p.notes),
    links: Array.isArray(p.links) ? p.links : [],
    progress_override: num(p.progress_override),
    cover_path: s(p.cover_path),
    cover_position: num(p.cover_position) ?? 50,
    icon_emoji: s(p.icon_emoji),
    icon_path: s(p.icon_path),
    idea_id: s(p.idea_id),
    last_activity_at: p.last_activity_at ?? p.updated_at ?? nowISO(),
    created_at: p.created_at ?? nowISO(),
    updated_at: p.updated_at ?? nowISO(),
  };
}

export function newTask(t: Partial<Task> = {}): Task {
  return normalizeTask({ ...base(), sort_order: Date.now(), ...t });
}
export function normalizeTask(t: Partial<Task>): Task {
  return {
    id: t.id ?? uid(),
    project_id: s(t.project_id),
    parent_id: s(t.parent_id),
    milestone_id: s(t.milestone_id),
    title: (t.title ?? "Untitled task").toString(),
    description: s(t.description),
    status: t.status ?? "inbox",
    priority: t.priority ?? "medium",
    due_date: s(t.due_date),
    scheduled_date: s(t.scheduled_date),
    effort_hours: num(t.effort_hours),
    actual_hours: num(t.actual_hours),
    cognitive_load: t.cognitive_load ?? "medium",
    recurrence: t.recurrence ?? "none",
    notes: s(t.notes),
    completed_at: s(t.completed_at),
    sort_order: num(t.sort_order) ?? 0,
    created_at: t.created_at ?? nowISO(),
    updated_at: t.updated_at ?? nowISO(),
  };
}

export function newMilestone(m: Partial<Milestone> & { project_id: string }): Milestone {
  return normalizeMilestone({ ...base(), sort_order: Date.now(), ...m });
}
export function normalizeMilestone(m: Partial<Milestone>): Milestone {
  return {
    id: m.id ?? uid(),
    project_id: m.project_id as string,
    title: (m.title ?? "Milestone").toString(),
    kind: m.kind ?? "milestone",
    due_date: s(m.due_date),
    completed_on: s(m.completed_on),
    venue: s(m.venue),
    decision: s(m.decision),
    notes: s(m.notes),
    sort_order: num(m.sort_order) ?? 0,
    created_at: m.created_at ?? nowISO(),
    updated_at: m.updated_at ?? nowISO(),
  };
}

export function normalizeDependency(d: Partial<TaskDependency>): TaskDependency {
  return {
    id: d.id ?? uid(),
    task_id: d.task_id as string,
    depends_on_id: d.depends_on_id as string,
    created_at: d.created_at ?? nowISO(),
    updated_at: d.updated_at ?? nowISO(),
  };
}

export function newWaiting(w: Partial<WaitingItem> = {}): WaitingItem {
  return normalizeWaiting({ ...base(), ...w });
}
export function normalizeWaiting(w: Partial<WaitingItem>): WaitingItem {
  return {
    id: w.id ?? uid(),
    project_id: s(w.project_id),
    task_id: s(w.task_id),
    waiting_for: (w.waiting_for ?? "External response").toString(),
    title: s(w.title),
    initiated_on: w.initiated_on ?? todayStr(),
    expected_on: s(w.expected_on),
    follow_up_on: s(w.follow_up_on),
    status: w.status ?? "waiting",
    reference: s(w.reference),
    notes: s(w.notes),
    resolved_at: s(w.resolved_at),
    created_at: w.created_at ?? nowISO(),
    updated_at: w.updated_at ?? nowISO(),
  };
}

export function newIdea(i: Partial<Idea> = {}): Idea {
  return normalizeIdea({ ...base(), ...i });
}
export function normalizeIdea(i: Partial<Idea>): Idea {
  return {
    id: i.id ?? uid(),
    title: (i.title ?? "Untitled idea").toString(),
    question: s(i.question),
    description: s(i.description),
    literature: s(i.literature),
    data_sources: s(i.data_sources),
    theory: s(i.theory),
    feasibility: i.feasibility ?? "medium",
    tags: Array.isArray(i.tags) ? i.tags.filter(Boolean) : [],
    status: i.status ?? "open",
    linked_project_id: s(i.linked_project_id),
    notes: s(i.notes),
    created_at: i.created_at ?? nowISO(),
    updated_at: i.updated_at ?? nowISO(),
  };
}

export function normalizeWeekly(w: Partial<WeeklyPlan>): WeeklyPlan {
  return {
    id: w.id ?? uid(),
    week_start: w.week_start as string,
    priority_project_ids: Array.isArray(w.priority_project_ids) ? w.priority_project_ids : [],
    deliverables: Array.isArray(w.deliverables) ? w.deliverables : [],
    capacity_hours: num(w.capacity_hours),
    review: w.review && typeof w.review === "object" ? w.review : {},
    reviewed_at: s(w.reviewed_at),
    created_at: w.created_at ?? nowISO(),
    updated_at: w.updated_at ?? nowISO(),
  };
}

export function normalizeActivity(a: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: a.id ?? uid(),
    project_id: s(a.project_id),
    kind: a.kind ?? "note",
    message: (a.message ?? "").toString(),
    created_at: a.created_at ?? nowISO(),
    updated_at: a.updated_at ?? nowISO(),
  };
}

export function normalizeSettings(x: Partial<UserSettings> | null | undefined): UserSettings {
  const v = x ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined && val !== null)),
    workspace_title: v.workspace_title ?? null,
    workspace_subtitle: v.workspace_subtitle ?? null,
    avatar_path: v.avatar_path ?? null,
    phases: Array.isArray(v.phases) && v.phases.length ? v.phases : null,
    project_statuses: Array.isArray(v.project_statuses) && v.project_statuses.length ? v.project_statuses : null,
    background: { ...DEFAULT_SETTINGS.background, ...(v.background ?? {}) },
    imported_backup_ids: Array.isArray(v.imported_backup_ids) ? v.imported_backup_ids : [],
  } as UserSettings;
}

export const NORMALIZERS: { [K in TableName]: (r: Partial<RowMap[K]>) => RowMap[K] } = {
  projects: normalizeProject,
  milestones: normalizeMilestone,
  tasks: normalizeTask,
  task_dependencies: normalizeDependency,
  waiting_items: normalizeWaiting,
  ideas: normalizeIdea,
  weekly_plans: normalizeWeekly,
  activity_log: normalizeActivity,
};

/** Strip fields the DB owns/doesn't know before sending. */
export function toDbRow<T extends object>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.user_id;
  return copy as T;
}
