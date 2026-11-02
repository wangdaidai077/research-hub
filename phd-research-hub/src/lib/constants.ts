import type {
  CognitiveLoad, PhaseDef, PipelineStage, Priority, StatusDef, TaskStatus, UserSettings, WaitingStatus, MilestoneKind,
} from "./types";

export const DEFAULT_PHASES: PhaseDef[] = [
  { key: "idea", label: "Idea Development", stage: "idea" },
  { key: "literature", label: "Literature Review", stage: "idea" },
  { key: "design", label: "Research Design", stage: "design" },
  { key: "collection", label: "Data Collection", stage: "collection" },
  { key: "cleaning", label: "Data Cleaning", stage: "collection" },
  { key: "analysis", label: "Data Analysis", stage: "analysis" },
  { key: "writing", label: "Manuscript Writing", stage: "writing" },
  { key: "submitted", label: "Submitted", stage: "submission" },
  { key: "under_review", label: "Under Review", stage: "review" },
  { key: "revision", label: "Revision", stage: "review" },
  { key: "published", label: "Accepted / Published", stage: "publication" },
];

export const DEFAULT_STATUSES: StatusDef[] = [
  { key: "backlog", label: "Backlog", kind: "backlog" },
  { key: "active", label: "Active", kind: "active" },
  { key: "maintenance", label: "Maintenance", kind: "maintenance" },
  { key: "waiting", label: "Waiting", kind: "waiting" },
  { key: "blocked", label: "Blocked", kind: "blocked" },
  { key: "completed", label: "Completed", kind: "completed" },
  { key: "archived", label: "Archived", kind: "archived" },
];

export const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "idea", label: "Idea" },
  { key: "design", label: "Research Design" },
  { key: "collection", label: "Data Collection" },
  { key: "analysis", label: "Analysis" },
  { key: "writing", label: "Writing" },
  { key: "submission", label: "Submission" },
  { key: "review", label: "Review" },
  { key: "publication", label: "Publication" },
];

export const STATUS_KINDS: { key: import("./types").StatusKind; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "active", label: "Active" },
  { key: "maintenance", label: "Maintenance" },
  { key: "waiting", label: "Waiting" },
  { key: "blocked", label: "Blocked" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "next", label: "Next" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting", label: "Waiting" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
  { key: "cancelled", label: "Cancelled" },
];

export const PRIORITIES: { key: Priority; label: string; rank: number }[] = [
  { key: "critical", label: "Critical", rank: 4 },
  { key: "high", label: "High", rank: 3 },
  { key: "medium", label: "Medium", rank: 2 },
  { key: "low", label: "Low", rank: 1 },
];
export const PRIORITY_RANK: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const COGNITIVE_LOADS: { key: CognitiveLoad; label: string; hint: string }[] = [
  { key: "deep", label: "Deep Work", hint: "Theory, research design, manuscript writing" },
  { key: "medium", label: "Medium Focus", hint: "Reading papers, data analysis, model specification" },
  { key: "light", label: "Light Work", hint: "Files, emails, formatting, downloads" },
];

export const WAITING_STATUSES: { key: WaitingStatus; label: string }[] = [
  { key: "waiting", label: "Waiting" },
  { key: "followed_up", label: "Followed up" },
  { key: "resolved", label: "Resolved" },
  { key: "cancelled", label: "Cancelled" },
];

export const MILESTONE_KINDS: { key: MilestoneKind; label: string }[] = [
  { key: "milestone", label: "Milestone" },
  { key: "submission", label: "Manuscript submission" },
  { key: "decision", label: "Journal decision" },
  { key: "revision", label: "Revision deadline" },
  { key: "conference", label: "Conference" },
];

export const RECURRENCES = [
  { key: "none", label: "Does not repeat" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "biweekly", label: "Every 2 weeks" },
  { key: "monthly", label: "Monthly" },
] as const;

export const VISUAL_THEMES = [
  { key: "graphite", label: "Graphite", desc: "Neutral and crisp", swatch: ["#fcfcfc", "#18181b", "#e4e4e7"] },
  { key: "paper", label: "Paper", desc: "Warm manuscript tones", swatch: ["#fbf9f5", "#231e19", "#e5ded3"] },
  { key: "nordic", label: "Nordic", desc: "Cool slate blues", swatch: ["#f8fafc", "#1a2230", "#dbe2ea"] },
  { key: "library", label: "Library", desc: "Quiet study greens", swatch: ["#f9faf8", "#172420", "#dde2da"] },
];

export const ACCENTS = [
  { key: "#3b5bdb", label: "Indigo" },
  { key: "#1c7c7d", label: "Teal" },
  { key: "#2f7d4f", label: "Forest" },
  { key: "#9a3b3b", label: "Oxblood" },
  { key: "#a8641c", label: "Amber" },
  { key: "#6b4fa0", label: "Plum" },
  { key: "#3f4a5a", label: "Slate" },
];

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  visual_theme: "graphite",
  accent: "#3b5bdb",
  workspace_title: null,
  workspace_subtitle: null,
  avatar_path: null,
  background: { mode: "none", brightness: 100, opacity: 100, blur: 0, overlay: 55 },
  phases: null,
  project_statuses: null,
  imported_backup_ids: [],
};

export const IMAGE_LIMITS = {
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
  maxInputBytes: 15 * 1024 * 1024, // before compression
  maxStoredBytes: 5 * 1024 * 1024, // after compression (matches bucket limit)
};
