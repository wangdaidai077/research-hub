"use client";
import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { addDays } from "date-fns";
import { Download, Kanban as KanbanIcon, ListChecks, Plus, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Segmented } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/input";
import { DueLabel, LoadIcon, PageHeader, PriorityIcon, ProjectLink } from "@/components/bits";
import { TaskRow } from "@/components/task-row";
import { Kanban } from "@/components/kanban";
import { useDialogs } from "@/components/dialog-store";
import { setTaskStatus } from "@/lib/actions";
import { exportTasksCSV } from "@/lib/backup";
import { COGNITIVE_LOADS, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { isOpenTask, isTaskOverdue, sortByDue, sortByImportance, unmetDependencies } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { toDateStr, todayStr, weekDays, weekStartStr } from "@/lib/utils";

export default function TasksPage() {
  return <Suspense><TasksInner /></Suspense>;
}

function TasksInner() {
  const params = useSearchParams();
  const { tasks, projects, task_dependencies } = useStore();
  const openTask = useDialogs((s) => s.openTask);
  const [view, setView] = React.useState<"list" | "board">("list");
  const [q, setQ] = React.useState("");
  const [project, setProject] = React.useState("");
  const [status, setStatus] = React.useState("open");
  const [priority, setPriority] = React.useState("");
  const [load, setLoad] = React.useState("");
  const [due, setDue] = React.useState(params.get("view") === "due" ? "week" : "");
  const [sort, setSort] = React.useState<"importance" | "due">("importance");
  const [group, setGroup] = React.useState<"status" | "project" | "none">("status");
  const [includeSubtasks, setIncludeSubtasks] = React.useState(true);

  const today = todayStr();
  const week = weekDays(weekStartStr());
  const in7 = toDateStr(addDays(new Date(), 7));

  const filtered = tasks.filter((t) => {
    if (!includeSubtasks && t.parent_id) return false;
    if (q && !`${t.title} ${t.description ?? ""} ${t.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (project === "none" ? t.project_id : project && t.project_id !== project) return false;
    if (status === "open" ? !isOpenTask(t) : status && status !== "all" && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (load && t.cognitive_load !== load) return false;
    if (due === "overdue" && !isTaskOverdue(t)) return false;
    if (due === "today" && t.due_date !== today && t.scheduled_date !== today) return false;
    if (due === "week" && !(t.due_date && t.due_date >= week[0] && t.due_date <= week[6])) return false;
    if (due === "next7" && !(t.due_date && t.due_date <= in7)) return false;
    if (due === "none" && t.due_date) return false;
    return true;
  }).sort(sort === "importance" ? sortByImportance : sortByDue);

  const overdueCount = tasks.filter(isTaskOverdue).length;

  const groups: { key: string; label: string; items: Task[] }[] =
    group === "none" ? [{ key: "all", label: "", items: filtered }]
      : group === "status" ? TASK_STATUSES.map((s) => ({ key: s.key, label: s.label, items: filtered.filter((t) => t.status === s.key) }))
        : [...projects.map((p) => ({ key: p.id, label: p.title, items: filtered.filter((t) => t.project_id === p.id) })), { key: "none", label: "No project", items: filtered.filter((t) => !t.project_id) }];

  return (
    <>
      <PageHeader
        title="All tasks"
        subtitle={<>{tasks.filter(isOpenTask).length} open{overdueCount > 0 && <> · <button className="text-destructive hover:underline" onClick={() => { setDue("overdue"); setStatus("open"); }}>{overdueCount} overdue</button></>} · waiting tasks never count as overdue</>}
        actions={<><Button variant="secondary" onClick={exportTasksCSV}><Download />CSV</Button><Button onClick={() => openTask({ project_id: project && project !== "none" ? project : null })}><Plus />New task</Button></>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} options={[{ value: "list", label: <><Rows3 />List</> }, { value: "board", label: <><KanbanIcon />Board</> }]} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="h-7 w-44 text-xs" />
        <Select value={project} onChange={(e) => setProject(e.target.value)} className="h-7 w-auto max-w-[200px] text-xs" aria-label="Project filter">
          <option value="">All projects</option><option value="none">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </Select>
        {view === "list" && (
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-7 w-auto text-xs" aria-label="Status filter">
            <option value="open">Open</option><option value="all">All statuses</option>
            {TASK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        )}
        <Select value={due} onChange={(e) => setDue(e.target.value)} className="h-7 w-auto text-xs" aria-label="Deadline filter">
          <option value="">Any deadline</option><option value="overdue">Overdue</option><option value="today">Today</option>
          <option value="week">Due this week</option><option value="next7">Due within 7 days</option><option value="none">No due date</option>
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-7 w-auto text-xs" aria-label="Priority filter">
          <option value="">Any priority</option>{PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Select>
        <Select value={load} onChange={(e) => setLoad(e.target.value)} className="h-7 w-auto text-xs" aria-label="Cognitive load filter">
          <option value="">Any load</option>{COGNITIVE_LOADS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={includeSubtasks} onChange={(e) => setIncludeSubtasks(e.target.checked)} className="accent-[hsl(var(--primary))]" />Subtasks</label>
          {view === "list" && <Select value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className="h-7 w-auto text-xs" aria-label="Group by">
            <option value="status">Group: status</option><option value="project">Group: project</option><option value="none">No grouping</option>
          </Select>}
          <Segmented value={sort} onChange={setSort} options={[{ value: "importance", label: "Importance" }, { value: "due", label: "Due date" }]} />
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No tasks yet" action={<Button onClick={() => openTask()}>Add a task</Button>}>Break projects into concrete next steps.</EmptyState>
      ) : view === "board" ? (
        <Kanban
          columns={TASK_STATUSES.map((s) => ({ key: s.key, label: s.label }))}
          items={filtered.filter(() => true)}
          columnOf={(t) => t.status}
          onMove={(t, col) => { setTaskStatus(t.id, col as Task["status"]); if (col === "done") toast.success("Completed"); }}
          renderItem={(t) => {
            const blocked = unmetDependencies(t, task_dependencies, tasks).length > 0;
            return (
              <div onClick={() => openTask(t)} className="surface rounded-md border bg-card p-2.5 shadow-sm hover:border-foreground/20">
                <div className="flex items-start gap-1.5"><PriorityIcon p={t.priority} /><span className="text-[13px] leading-snug">{t.title}</span></div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProjectLink id={t.project_id} className="max-w-[150px]" />
                  <LoadIcon l={t.cognitive_load} />
                  {t.due_date && <DueLabel date={t.due_date} status={t.status} />}
                  {blocked && <span className="text-[11px] text-warning">Blocked</span>}
                </div>
              </div>
            );
          }}
        />
      ) : (
        <Card className="py-1">
          {filtered.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No tasks match these filters.</p>}
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.key} className="border-b px-2 pb-1 pt-2 last:border-0">
              {g.label && <div className="section-label px-2 pb-1">{g.label} · {g.items.length}</div>}
              {g.items.map((t) => <TaskRow key={t.id} task={t} showProject={group !== "project"} showStatus={group !== "status"} />)}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
