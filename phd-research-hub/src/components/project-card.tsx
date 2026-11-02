"use client";
import Link from "next/link";
import { ArrowRight, CalendarClock, Hourglass } from "lucide-react";
import { ProgressBar } from "@/components/ui/misc";
import { DueLabel, PhaseBadge, PriorityIcon, ProjectCover, ProjectIcon, ProjectStatusBadge } from "@/components/bits";
import { useDialogs } from "@/components/dialog-store";
import { nextActionable, projectNextDeadline, projectProgress, waitingActive } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Project } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export function ProjectCard({ project: p }: { project: Project }) {
  const tasks = useStore((s) => s.tasks);
  const deps = useStore((s) => s.task_dependencies);
  const milestones = useStore((s) => s.milestones);
  const waiting = useStore((s) => s.waiting_items);
  const settings = useStore((s) => s.settings);
  const openTask = useDialogs((s) => s.openTask);
  const next = nextActionable(p.id, tasks, deps);
  const prog = projectProgress(p, tasks, milestones, settings);
  const deadline = projectNextDeadline(p, milestones);
  const waits = waiting.filter((w) => w.project_id === p.id && waitingActive(w)).length;

  return (
    <div className="surface group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-foreground/20 hover:shadow-md">
      <Link href={`/projects/${p.id}`} className="absolute inset-0 z-0" aria-label={`Open ${p.title}`} />
      <ProjectCover project={p} className="h-[68px]" />
      <div className="relative -mt-4 ml-4 w-fit rounded-md bg-card p-1 shadow-sm ring-1 ring-border">
        <ProjectIcon project={p} size={22} />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-3.5 pt-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight">{p.title}</h3>
          <PriorityIcon p={p.priority} />
        </div>
        {p.category && <div className="mt-0.5 text-[11px] text-muted-foreground">{p.category}</div>}
        {p.description && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.description}</p>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <PhaseBadge phase={p.phase} />
          <ProjectStatusBadge status={p.status} />
          {waits > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-warning"><Hourglass className="h-3 w-3" />{waits} waiting</span>}
        </div>

        <div className="mt-3 border-t pt-2.5">
          <div className="section-label mb-1">Next action</div>
          {next ? (
            <button onClick={() => openTask(next)} className="relative z-10 flex w-full items-center gap-1.5 text-left text-[12.5px] hover:text-primary">
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" /><span className="truncate">{next.title}</span>
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">No actionable task</p>
          )}
        </div>

        <div className="mt-auto pt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span title={prog.source === "manual" ? "Manual estimate" : prog.source === "work" ? "Estimated from tasks & milestones" : "Rough estimate from research phase"}>
              {prog.source === "manual" ? "Estimated (manual)" : prog.source === "phase" ? "Phase estimate" : "Estimated progress"} · {prog.value}%
            </span>
            {prog.milestonesTotal > 0 && <span>{prog.milestonesDone}/{prog.milestonesTotal} milestones</span>}
          </div>
          <ProgressBar value={prog.value} muted={prog.source === "phase"} />
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
            {deadline ? (
              <span className="inline-flex items-center gap-1 truncate" title={deadline.label}><CalendarClock className="h-3 w-3" /><DueLabel date={deadline.date} /></span>
            ) : <span>No deadline</span>}
            <span>Active {timeAgo(p.last_activity_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
