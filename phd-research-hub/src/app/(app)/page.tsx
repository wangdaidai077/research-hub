"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { Activity, ArrowRight, CalendarClock, Flag, FolderPlus, Hourglass, Plus, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, Segmented, Stat } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/input";
import { DueLabel, PageHeader, ProjectIcon } from "@/components/bits";
import { ProjectCard } from "@/components/project-card";
import { TaskRow } from "@/components/task-row";
import { useDialogs } from "@/components/dialog-store";
import { PIPELINE_STAGES, PRIORITY_RANK } from "@/lib/constants";
import { loadSampleData } from "@/lib/sample";
import {
  followUpState, isOpenTask, isTaskOverdue, phaseStage, projectNextDeadline, projectProgress, sortByImportance, statusKind, statusesOf, waitingActive,
} from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { cn, fmtDate, timeAgo, toDateStr, todayStr, weekDays, weekStartStr } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const router = useRouter();
  const { projects, tasks, milestones, waiting_items, weekly_plans, activity_log, settings } = useStore();
  const { openProject, openTask } = useDialogs();
  const today = todayStr();
  const week = weekDays(weekStartStr());
  const weekEnd = week[6];
  const in14 = toDateStr(addDays(new Date(), 14));

  const visible = projects.filter((p) => statusKind(settings, p.status) !== "archived");
  const kindOf = (p: (typeof projects)[number]) => statusKind(settings, p.status);
  const activeWaitingProjects = new Set(waiting_items.filter(waitingActive).map((w) => w.project_id).filter(Boolean));
  const waitingProjects = visible.filter((p) => kindOf(p) === "waiting" || activeWaitingProjects.has(p.id));
  const openTasks = tasks.filter(isOpenTask);
  const dueThisWeek = openTasks.filter((t) => t.due_date && t.due_date >= week[0] && t.due_date <= weekEnd);
  const overdue = tasks.filter(isTaskOverdue);
  const completed30 = tasks.filter((t) => t.status === "done" && t.completed_at && t.completed_at >= toDateStr(addDays(new Date(), -30)));

  type Deadline = { key: string; date: string; title: string; kind: string; projectId: string | null; onClick: () => void };
  const deadlines: Deadline[] = [
    ...openTasks.filter((t) => t.due_date && t.due_date <= in14).map((t) => ({ key: "t" + t.id, date: t.due_date!, title: t.title, kind: "Task", projectId: t.project_id, onClick: () => openTask(t) })),
    ...milestones.filter((m) => !m.completed_on && m.due_date && m.due_date <= in14).map((m) => ({ key: "m" + m.id, date: m.due_date!, title: m.title, kind: "Milestone", projectId: m.project_id, onClick: () => router.push(`/projects/${m.project_id}?tab=milestones`) })),
    ...visible.filter((p) => p.target_date && p.target_date >= today && p.target_date <= in14 && kindOf(p) !== "completed").map((p) => ({ key: "p" + p.id, date: p.target_date!, title: `${p.title} — target completion`, kind: "Project", projectId: p.id, onClick: () => router.push(`/projects/${p.id}`) })),
    ...waiting_items.filter((w) => followUpState(w) === "overdue" || (w.follow_up_on && waitingActive(w) && w.follow_up_on <= in14)).map((w) => ({ key: "w" + w.id, date: w.follow_up_on!, title: `Follow up: ${w.waiting_for}`, kind: "Follow-up", projectId: w.project_id, onClick: () => router.push("/waiting") })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  const focus = openTasks.filter((t) => t.scheduled_date === today || isTaskOverdue(t)).sort(sortByImportance);
  const plan = weekly_plans.find((w) => w.week_start === week[0]);
  const priorityProjects = (plan?.priority_project_ids ?? []).map((id) => projects.find((p) => p.id === id)).filter(Boolean) as typeof projects;

  // pipeline counts
  const stageCounts = PIPELINE_STAGES.map((s) => ({ ...s, n: visible.filter((p) => kindOf(p) !== "completed" && phaseStage(settings, p.phase) === s.key).length }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

  // ---------- portfolio sort/filter ----------
  const [sort, setSort] = React.useState<"priority" | "activity" | "deadline" | "progress" | "title">("priority");
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [areaFilter, setAreaFilter] = React.useState("");
  const [q, setQ] = React.useState("");
  const areas = Array.from(new Set(projects.map((p) => p.category).filter(Boolean))) as string[];
  let list = projects.filter((p) => {
    const k = kindOf(p);
    if (statusFilter === "open" && (k === "archived" || k === "completed")) return false;
    if (statusFilter !== "open" && statusFilter !== "all" && p.status !== statusFilter) return false;
    if (areaFilter && p.category !== areaFilter) return false;
    if (q && !`${p.title} ${p.description ?? ""} ${p.category ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  list = [...list].sort((a, b) => {
    if (sort === "priority") return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || (b.last_activity_at > a.last_activity_at ? 1 : -1);
    if (sort === "activity") return b.last_activity_at > a.last_activity_at ? 1 : -1;
    if (sort === "deadline") return (projectNextDeadline(a, milestones)?.date ?? "9999") < (projectNextDeadline(b, milestones)?.date ?? "9999") ? -1 : 1;
    if (sort === "progress") return projectProgress(b, tasks, milestones, settings).value - projectProgress(a, tasks, milestones, settings).value;
    return a.title.localeCompare(b.title);
  });

  if (projects.length === 0) {
    return (
      <>
        <PageHeader eyebrow={format(new Date(), "EEEE, MMMM d")} title={`${greeting()}.`} subtitle="Your research portfolio is empty." />
        <EmptyState icon={<Sparkles />} title="Set up your research command center"
          action={<div className="flex gap-2"><Button onClick={() => openProject()}><FolderPlus />Create a project</Button><Button variant="secondary" onClick={loadSampleData}>Load sample projects</Button></div>}>
          Start with your own project, or load five editable sample projects (housing recovery, HOA governance, Florida response, SECO, NHTS) to explore how everything fits together.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={format(new Date(), "EEEE, MMMM d")}
        title={`${greeting()}.`}
        subtitle={focus.length ? `${focus.length} task${focus.length > 1 ? "s" : ""} in focus today${overdue.length ? ` · ${overdue.length} overdue` : ""}.` : "Nothing scheduled for today yet — pick something from your week."}
        actions={<><Button variant="secondary" onClick={() => openTask({ scheduled_date: today })}><Plus />Task</Button><Button onClick={() => openProject()}><FolderPlus />New project</Button></>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Research projects" value={visible.length} sub={`${projects.length - visible.length} archived`} onClick={() => router.push("/projects")} />
        <Stat label="Active" value={visible.filter((p) => kindOf(p) === "active").length} sub={`${visible.filter((p) => kindOf(p) === "maintenance").length} in maintenance`} />
        <Stat label="Waiting on others" value={waitingProjects.length} sub={`${waiting_items.filter(waitingActive).length} open requests`} onClick={() => router.push("/waiting")} />
        <Stat label="Deadlines · 14 days" value={deadlines.length} sub={deadlines[0] ? `Next: ${fmtDate(deadlines[0].date)}` : "None upcoming"} />
        <Stat label="Due this week" value={dueThisWeek.length} tone={overdue.length ? "danger" : undefined} sub={overdue.length ? `${overdue.length} overdue` : "On track"} onClick={() => router.push("/tasks?view=due")} />
        <Stat label="Completed · 30 days" value={completed30.length} sub={`${tasks.filter((t) => t.status === "done").length} all-time`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Today's focus" subtitle="Scheduled for today and overdue" action={<Link href="/today" className="text-xs text-muted-foreground hover:text-foreground">Open <ArrowRight className="inline h-3 w-3" /></Link>} />
          <div className="px-2 pb-2">
            {focus.length === 0 ? (
              <p className="px-2 pb-3 text-xs text-muted-foreground">Nothing scheduled. Assign tasks to today from the <Link href="/planner" className="text-primary hover:underline">weekly planner</Link>.</p>
            ) : focus.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} />)}
            {focus.length > 6 && <Link href="/today" className="block px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">+{focus.length - 6} more</Link>}
          </div>
        </Card>

        <Card>
          <CardHeader title="This week's priorities" subtitle={`Week of ${fmtDate(week[0])}`} action={<Link href="/planner" className="text-xs text-muted-foreground hover:text-foreground">Plan <ArrowRight className="inline h-3 w-3" /></Link>} />
          <div className="px-4 pb-4">
            {priorityProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No priorities chosen. <Link href="/planner" className="text-primary hover:underline">Choose up to two</Link> to protect your focus.</p>
            ) : (
              <div className="space-y-2">
                {priorityProjects.map((p, i) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2.5 rounded-md border px-3 py-2 hover:bg-accent/50">
                    <span className="font-serif text-lg text-muted-foreground">{i + 1}</span>
                    <ProjectIcon project={p} size={18} />
                    <span className="truncate text-[13px] font-medium">{p.title}</span>
                  </Link>
                ))}
              </div>
            )}
            {plan && plan.deliverables.length > 0 && (
              <div className="mt-4">
                <div className="section-label mb-1.5">Deliverables · {plan.deliverables.filter((d) => d.done).length}/{plan.deliverables.length}</div>
                <ul className="space-y-1">
                  {plan.deliverables.slice(0, 5).map((d) => (
                    <li key={d.id} className={cn("flex items-center gap-2 text-[13px]", d.done && "text-muted-foreground line-through")}>
                      <Target className="h-3 w-3 shrink-0 text-muted-foreground" />{d.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming deadlines" subtitle="Next 14 days, incl. follow-ups" />
          <div className="px-2 pb-2">
            {deadlines.length === 0 ? <p className="px-2 pb-3 text-xs text-muted-foreground">No deadlines in the next two weeks.</p> :
              deadlines.slice(0, 7).map((d) => {
                const p = projects.find((x) => x.id === d.projectId);
                return (
                  <button key={d.key} onClick={d.onClick} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent/60">
                    {d.kind === "Milestone" ? <Flag className="h-3.5 w-3.5 text-primary" /> : d.kind === "Follow-up" ? <Hourglass className="h-3.5 w-3.5 text-warning" /> : <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">{d.title}</div>
                      {p && <div className="truncate text-[11px] text-muted-foreground">{p.title}</div>}
                    </div>
                    <DueLabel date={d.date} />
                  </button>
                );
              })}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Research pipeline" subtitle="Active projects by stage — watch for a pile-up at the idea end" action={<Link href="/pipeline" className="text-xs text-muted-foreground hover:text-foreground">Pipeline <ArrowRight className="inline h-3 w-3" /></Link>} />
          <div className="grid grid-cols-8 gap-1.5 px-4 pb-4 pt-2">
            {stageCounts.map((s) => (
              <Link key={s.key} href="/pipeline" className="group flex flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end rounded-md bg-muted/60 p-1">
                  <div className="w-full rounded-[4px] bg-primary/80 transition-all group-hover:bg-primary" style={{ height: `${s.n ? Math.max(10, (s.n / maxStage) * 100) : 0}%` }} />
                </div>
                <div className="font-serif text-base leading-none tabular-nums">{s.n}</div>
                <div className="text-center text-[10px] leading-tight text-muted-foreground">{s.label}</div>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          <div className="scroll-thin max-h-[210px] overflow-y-auto px-4 pb-3">
            {activity_log.length === 0 ? <p className="text-xs text-muted-foreground">No activity yet.</p> :
              [...activity_log].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 14).map((a) => {
                const p = projects.find((x) => x.id === a.project_id);
                return (
                  <div key={a.id} className="flex gap-2.5 border-l py-1.5 pl-3 -ml-px relative">
                    <span className="absolute -left-[3px] top-3 h-1.5 w-1.5 rounded-full bg-border" />
                    <div className="min-w-0">
                      <div className="text-[12.5px] leading-snug">{a.message}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{p ? `${p.title} · ` : ""}{timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl tracking-tight">Portfolio</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter projects…" className="h-7 w-40 text-xs" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-7 w-auto text-xs">
              <option value="open">Open projects</option>
              <option value="all">All projects</option>
              {statusesOf(settings).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
            <Select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="h-7 w-auto text-xs">
              <option value="">All areas</option>
              {areas.map((a) => <option key={a}>{a}</option>)}
            </Select>
            <Segmented value={sort} onChange={setSort} options={[
              { value: "priority", label: "Priority" }, { value: "activity", label: "Recent" }, { value: "deadline", label: "Deadline" },
              { value: "progress", label: "Progress" }, { value: "title", label: "A–Z" },
            ]} />
          </div>
        </div>
        {list.length === 0 ? <EmptyState title="No projects match these filters" /> : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </section>
      <p className="mt-8 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Activity className="h-3 w-3" />All figures are computed live from your stored projects, tasks and milestones.</p>
    </>
  );
}
