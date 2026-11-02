// Domain model. Field names mirror the PostgreSQL columns (snake_case) so rows
// can move between the database, the in-memory store and JSON backups unchanged.

export type ID = string;
export type ISODate = string; // yyyy-MM-dd
export type ISOTime = string; // full timestamp

export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "inbox" | "next" | "in_progress" | "waiting" | "blocked" | "done" | "cancelled";
export type CognitiveLoad = "deep" | "medium" | "light";
export type Recurrence = "none" | "daily" | "weekly" | "biweekly" | "monthly";
export type WaitingStatus = "waiting" | "followed_up" | "resolved" | "cancelled";
export type MilestoneKind = "milestone" | "submission" | "decision" | "revision" | "conference";

/** Coarse pipeline stage that each (customisable) research phase maps onto. */
export type PipelineStage =
  | "idea" | "design" | "collection" | "analysis" | "writing" | "submission" | "review" | "publication";

/** Semantic meaning of a (customisable) project activity status. */
export type StatusKind = "backlog" | "active" | "maintenance" | "waiting" | "blocked" | "completed" | "archived";

export interface PhaseDef { key: string; label: string; stage: PipelineStage }
export interface StatusDef { key: string; label: string; kind: StatusKind }

export interface ProjectLink { id: ID; label: string; url: string }

export interface Project {
  id: ID;
  user_id?: ID;
  title: string;
  research_question: string | null;
  description: string | null;
  category: string | null;
  collaborators: string | null;
  start_date: ISODate | null;
  target_date: ISODate | null;
  priority: Priority;
  phase: string;
  status: string;
  notes: string | null;
  links: ProjectLink[];
  progress_override: number | null;
  cover_path: string | null;
  cover_position: number;
  icon_emoji: string | null;
  icon_path: string | null;
  idea_id: ID | null;
  last_activity_at: ISOTime;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface Milestone {
  id: ID;
  user_id?: ID;
  project_id: ID;
  title: string;
  kind: MilestoneKind;
  due_date: ISODate | null;
  completed_on: ISODate | null;
  venue: string | null;
  decision: string | null;
  notes: string | null;
  sort_order: number;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface Task {
  id: ID;
  user_id?: ID;
  project_id: ID | null;
  parent_id: ID | null;
  milestone_id: ID | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: ISODate | null;
  scheduled_date: ISODate | null;
  effort_hours: number | null;
  actual_hours: number | null;
  cognitive_load: CognitiveLoad;
  recurrence: Recurrence;
  notes: string | null;
  completed_at: ISOTime | null;
  sort_order: number;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface TaskDependency {
  id: ID;
  user_id?: ID;
  task_id: ID;
  depends_on_id: ID;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface WaitingItem {
  id: ID;
  user_id?: ID;
  project_id: ID | null;
  task_id: ID | null;
  waiting_for: string;
  title: string | null;
  initiated_on: ISODate;
  expected_on: ISODate | null;
  follow_up_on: ISODate | null;
  status: WaitingStatus;
  reference: string | null;
  notes: string | null;
  resolved_at: ISOTime | null;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface Idea {
  id: ID;
  user_id?: ID;
  title: string;
  question: string | null;
  description: string | null;
  literature: string | null;
  data_sources: string | null;
  theory: string | null;
  feasibility: "low" | "medium" | "high";
  tags: string[];
  status: "open" | "archived" | "promoted";
  linked_project_id: ID | null;
  notes: string | null;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface Deliverable { id: ID; text: string; done: boolean; project_id?: ID | null }
export interface WeeklyReview {
  completed?: string;
  progressed?: string;
  obstacles?: string;
  carry_over?: string;
  next_priorities?: string;
}

export interface WeeklyPlan {
  id: ID;
  user_id?: ID;
  week_start: ISODate;
  priority_project_ids: ID[];
  deliverables: Deliverable[];
  capacity_hours: number | null;
  review: WeeklyReview;
  reviewed_at: ISOTime | null;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface ActivityEntry {
  id: ID;
  user_id?: ID;
  project_id: ID | null;
  kind: string;
  message: string;
  created_at: ISOTime;
  updated_at: ISOTime;
}

export interface BackgroundSettings {
  mode: "none" | "image" | "color";
  path?: string | null;
  color?: string;
  brightness?: number; // 40–130 (%)
  opacity?: number; // 0–100 (%) image visibility
  blur?: number; // 0–24 px
  overlay?: number; // 0–90 (%) tint of the page colour over the image
}

export interface UserSettings {
  user_id?: ID;
  theme: "light" | "dark" | "system";
  visual_theme: string;
  accent: string;
  workspace_title: string | null;
  workspace_subtitle: string | null;
  avatar_path: string | null;
  background: BackgroundSettings;
  phases: PhaseDef[] | null;
  project_statuses: StatusDef[] | null;
  imported_backup_ids: string[];
  created_at?: ISOTime;
  updated_at?: ISOTime;
}

export type TableName =
  | "projects" | "milestones" | "tasks" | "task_dependencies" | "waiting_items"
  | "ideas" | "weekly_plans" | "activity_log";

export interface RowMap {
  projects: Project;
  milestones: Milestone;
  tasks: Task;
  task_dependencies: TaskDependency;
  waiting_items: WaitingItem;
  ideas: Idea;
  weekly_plans: WeeklyPlan;
  activity_log: ActivityEntry;
}

export const TABLES: TableName[] = [
  "projects", "milestones", "tasks", "task_dependencies", "waiting_items", "ideas", "weekly_plans", "activity_log",
];

export type Snapshot = { [K in TableName]: RowMap[K][] } & { settings: UserSettings };

export interface BackupFile extends Snapshot {
  format: "phd-research-hub-backup";
  version: 1;
  backup_id: string;
  exported_at: ISOTime;
}
