"use client";
import * as React from "react";
import { addDays } from "date-fns";
import { CalendarClock, CalendarX, Link2, ListTree, MoreHorizontal, Pencil, Repeat, Trash2, ArrowRightLeft, CalendarPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/menu";
import { confirmDialog } from "@/components/ui/confirm";
import { DueLabel, LoadIcon, PriorityIcon, ProjectLink, TaskStatusBadge } from "@/components/bits";
import { useDialogs } from "@/components/dialog-store";
import { deleteTask, setTaskStatus, toggleTaskDone, updateTask } from "@/lib/actions";
import { TASK_STATUSES } from "@/lib/constants";
import { unmetDependencies } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn, fmtDate, toDateStr } from "@/lib/utils";
import { toast } from "sonner";

export function TaskRow({ task, showProject = true, compact, showStatus, className, draggable, onDragStart }: {
  task: Task; showProject?: boolean; compact?: boolean; showStatus?: boolean; className?: string;
  draggable?: boolean; onDragStart?: (e: React.DragEvent) => void;
}) {
  const openTask = useDialogs((s) => s.openTask);
  const deps = useStore((s) => s.task_dependencies);
  const tasks = useStore((s) => s.tasks);
  const subtasks = tasks.filter((t) => t.parent_id === task.id);
  const subDone = subtasks.filter((t) => t.status === "done").length;
  const blockers = unmetDependencies(task, deps, tasks);
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";

  async function onDelete() {
    if (await confirmDialog({ title: "Delete task?", description: `“${task.title}” and its subtasks will be permanently deleted.`, confirmLabel: "Delete", destructive: true })) {
      deleteTask(task.id);
      toast.success("Task deleted");
    }
  }

  function complete(v: boolean) {
    if (v && blockers.length) toast.message("Completed — note it still had open dependencies", { description: blockers.map((b) => b.title).join(", ") });
    toggleTaskDone(task);
    if (v && task.recurrence !== "none") toast.success("Done — next occurrence scheduled");
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => openTask(task)}
      className={cn(
        "group flex cursor-pointer items-start gap-2.5 rounded-md px-2 transition-colors hover:bg-accent/60",
        compact ? "py-1.5" : "py-2",
        className,
      )}
      data-task-id={task.id}
    >
      <Checkbox checked={done} onChange={complete} label={`Mark “${task.title}” ${done ? "not done" : "done"}`} className="mt-[2px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <PriorityIcon p={task.priority} />
          <span className={cn("truncate text-[13px] leading-5", (done || cancelled) && "text-muted-foreground line-through decoration-foreground/30")}>{task.title}</span>
        </div>
        {!compact && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-5">
            {showProject && <ProjectLink id={task.project_id} className="max-w-[220px]" />}
            <LoadIcon l={task.cognitive_load} />
            {task.due_date && <DueLabel date={task.due_date} status={task.status} prefix="Due " />}
            {task.scheduled_date && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Scheduled work date">
                <CalendarClock className="h-3 w-3" />{fmtDate(task.scheduled_date, "EEE MMM d")}
              </span>
            )}
            {task.effort_hours ? <span className="text-[11px] tabular-nums text-muted-foreground">{task.effort_hours}h</span> : null}
            {subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ListTree className="h-3 w-3" />{subDone}/{subtasks.length}</span>
            )}
            {blockers.length > 0 && !done && (
              <span className="inline-flex items-center gap-1 text-[11px] text-warning" title={`Depends on: ${blockers.map((b) => b.title).join(", ")}`}>
                <Link2 className="h-3 w-3" />Blocked by {blockers.length}
              </span>
            )}
            {task.recurrence !== "none" && <Repeat className="h-3 w-3 text-muted-foreground" aria-label="Recurring" />}
            {showStatus && <TaskStatusBadge s={task.status} />}
          </div>
        )}
      </div>
      {compact && task.due_date && <DueLabel date={task.due_date} status={task.status} />}
      <Menu>
        <MenuTrigger asChild>
          <button onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100" aria-label="Task actions">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </MenuTrigger>
        <MenuContent>
          <div onClick={(e) => e.stopPropagation()}>
            <MenuItem onSelect={() => openTask(task)}><Pencil />Edit</MenuItem>
            <MenuSub>
              <MenuSubTrigger><ArrowRightLeft />Move to</MenuSubTrigger>
              <MenuSubContent>
                {TASK_STATUSES.map((s) => (
                  <MenuItem key={s.key} onSelect={() => setTaskStatus(task.id, s.key)} className={cn(task.status === s.key && "font-semibold")}>{s.label}</MenuItem>
                ))}
              </MenuSubContent>
            </MenuSub>
            <MenuSub>
              <MenuSubTrigger><CalendarPlus />Schedule</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem onSelect={() => updateTask(task.id, { scheduled_date: toDateStr(new Date()) })}>Today</MenuItem>
                <MenuItem onSelect={() => updateTask(task.id, { scheduled_date: toDateStr(addDays(new Date(), 1)) })}>Tomorrow</MenuItem>
                <MenuItem onSelect={() => updateTask(task.id, { scheduled_date: toDateStr(addDays(new Date(), 7)) })}>In a week</MenuItem>
                {task.scheduled_date && <MenuItem onSelect={() => updateTask(task.id, { scheduled_date: null })}><CalendarX />Unschedule</MenuItem>}
              </MenuSubContent>
            </MenuSub>
            <MenuSeparator />
            <MenuItem danger onSelect={onDelete}><Trash2 />Delete</MenuItem>
          </div>
        </MenuContent>
      </Menu>
    </div>
  );
}
