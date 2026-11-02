"use client";
// Small shared display pieces.
import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, ArrowUp, Brain, Coffee, Equal, Flame, Focus, Hourglass } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/misc";
import { useImageUrl } from "@/lib/images";
import { useStore } from "@/lib/store";
import { phaseLabel, statusDef } from "@/lib/selectors";
import type { CognitiveLoad, Priority, Project, StatusKind, TaskStatus } from "@/lib/types";
import { cn, daysUntil, relDate } from "@/lib/utils";
import { TASK_STATUSES } from "@/lib/constants";

export function PriorityIcon({ p, className }: { p: Priority; className?: string }) {
  const map = {
    critical: <Flame className={cn("text-destructive", className)} />,
    high: <ArrowUp className={cn("text-warning", className)} />,
    medium: <Equal className={cn("text-muted-foreground", className)} />,
    low: <ArrowDown className={cn("text-muted-foreground/60", className)} />,
  };
  return <span title={`${p[0].toUpperCase() + p.slice(1)} priority`} className="inline-flex [&_svg]:size-3.5">{map[p]}</span>;
}

export function PriorityBadge({ p }: { p: Priority }) {
  const tone: Record<Priority, Tone> = { critical: "danger", high: "warning", medium: "neutral", low: "outline" };
  return <Badge tone={tone[p]}>{p[0].toUpperCase() + p.slice(1)}</Badge>;
}

const kindTone: Record<StatusKind, Tone> = {
  backlog: "outline", active: "primary", maintenance: "neutral", waiting: "warning", blocked: "danger", completed: "success", archived: "outline",
};
export function ProjectStatusBadge({ status }: { status: string }) {
  const settings = useStore((s) => s.settings);
  const d = statusDef(settings, status);
  return <Badge tone={kindTone[d.kind]} dot>{d.label}</Badge>;
}
export function PhaseBadge({ phase }: { phase: string }) {
  const settings = useStore((s) => s.settings);
  return <Badge tone="outline">{phaseLabel(settings, phase)}</Badge>;
}

const taskTone: Record<TaskStatus, Tone> = {
  inbox: "outline", next: "neutral", in_progress: "primary", waiting: "warning", blocked: "danger", done: "success", cancelled: "outline",
};
export function TaskStatusBadge({ s }: { s: TaskStatus }) {
  return <Badge tone={taskTone[s]}>{TASK_STATUSES.find((x) => x.key === s)?.label}</Badge>;
}

export function LoadIcon({ l, withLabel }: { l: CognitiveLoad; withLabel?: boolean }) {
  const m = {
    deep: { i: <Brain />, t: "Deep work", c: "text-primary" },
    medium: { i: <Focus />, t: "Medium focus", c: "text-foreground/60" },
    light: { i: <Coffee />, t: "Light work", c: "text-muted-foreground/70" },
  }[l];
  return (
    <span title={m.t} className={cn("inline-flex items-center gap-1 text-[11px] [&_svg]:size-3.5", m.c)}>
      {m.i}{withLabel && m.t}
    </span>
  );
}

export function DueLabel({ date, status, className, prefix }: { date: string | null; status?: TaskStatus; className?: string; prefix?: string }) {
  if (!date) return null;
  const n = daysUntil(date)!;
  const done = status === "done" || status === "cancelled";
  const waiting = status === "waiting";
  const tone = done ? "text-muted-foreground/60" : n < 0 && !waiting ? "text-destructive" : n <= 2 ? "text-warning" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] tabular-nums whitespace-nowrap", tone, className)} title={date}>
      {n < 0 && !done && !waiting && <AlertCircle className="h-3 w-3" />}
      {n < 0 && waiting && !done && <Hourglass className="h-3 w-3" />}
      {prefix}{relDate(date)}
    </span>
  );
}

/** Emoji, uploaded image, or a monogram — always renders something. */
export function ProjectIcon({ project, size = 20, className }: { project: Pick<Project, "icon_emoji" | "icon_path" | "title">; size?: number; className?: string }) {
  const { url } = useImageUrl(project.icon_path);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [url]);
  const style = { width: size, height: size, fontSize: size * 0.7 };
  if (project.icon_path && url && !failed)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" onError={() => setFailed(true)} style={style} className={cn("shrink-0 rounded-[5px] object-cover", className)} />;
  if (project.icon_emoji) return <span style={style} className={cn("grid shrink-0 place-items-center leading-none", className)}>{project.icon_emoji}</span>;
  return (
    <span style={{ ...style, fontSize: size * 0.5 }} className={cn("grid shrink-0 place-items-center rounded-[5px] bg-muted font-serif font-medium text-muted-foreground", className)}>
      {project.title.trim()[0]?.toUpperCase() ?? "·"}
    </span>
  );
}

/** Cover image with vertical repositioning and a quiet default pattern. */
export function ProjectCover({ project, className, children }: { project: Pick<Project, "cover_path" | "cover_position">; className?: string; children?: React.ReactNode }) {
  const { url, loading } = useImageUrl(project.cover_path);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [url]);
  const show = project.cover_path && url && !failed;
  return (
    <div className={cn("relative overflow-hidden default-cover", className)}>
      {show && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url!} alt="" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-500"
          style={{ objectPosition: `50% ${project.cover_position}%` }} />
      )}
      {project.cover_path && loading && <div className="absolute inset-0 animate-pulse bg-muted/50" />}
      {children}
    </div>
  );
}

export function ProjectLink({ id, className }: { id: string | null; className?: string }) {
  const p = useStore((s) => (id ? s.projects.find((x) => x.id === id) : undefined));
  if (!p) return <span className={cn("text-[11px] text-muted-foreground/70", className)}>No project</span>;
  return (
    <Link href={`/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className={cn("inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground", className)}>
      <ProjectIcon project={p} size={13} />
      <span className="truncate">{p.title}</span>
    </Link>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="section-label mb-1.5">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
