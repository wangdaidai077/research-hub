"use client";
import * as React from "react";
import Link from "next/link";
import { addDays, addWeeks, format } from "date-fns";
import { Brain, CalendarClock, ChevronLeft, ChevronRight, Coffee, Flag, Focus, Hourglass, Plus, Save, Target, Trash2, Undo2, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, Segmented } from "@/components/ui/misc";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { DueLabel, PageHeader, PriorityIcon, ProjectIcon } from "@/components/bits";
import { TaskRow } from "@/components/task-row";
import { useDialogs } from "@/components/dialog-store";
import { getOrCreateWeek, rescheduleTasks, saveWeek, updateTask } from "@/lib/actions";
import { COGNITIVE_LOADS } from "@/lib/constants";
import { isOpenTask, isTaskOverdue, sortByImportance, statusKind, waitingActive } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Task, WeeklyReview } from "@/lib/types";
import { cn, fmtDate, parseDate, toDateStr, todayStr, uid, weekDays, weekStartStr } from "@/lib/utils";

export function Planner({ initialTab = "week" }: { initialTab?: "week" | "today" | "review" }) {
  const [tab, setTab] = React.useState(initialTab);
  const [weekStart, setWeekStart] = React.useState(weekStartStr());
  const shift = (n: number) => setWeekStart(toDateStr(addWeeks(parseDate(weekStart)!, n)));
  const isThisWeek = weekStart === weekStartStr();
  return (
    <>
      <PageHeader
        eyebrow={tab === "today" ? format(new Date(), "EEEE, MMMM d") : `Week of ${fmtDate(weekStart, "MMMM d")}`}
        title={tab === "today" ? "Today's focus" : tab === "review" ? "Weekly review" : "Weekly planner"}
        actions={<>
          {tab !== "today" && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Previous week"><ChevronLeft /></Button>
              {!isThisWeek && <Button size="sm" variant="ghost" onClick={() => setWeekStart(weekStartStr())}>This week</Button>}
              <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Next week"><ChevronRight /></Button>
            </div>
          )}
          <Segmented value={tab} onChange={setTab} options={[{ value: "week", label: "Week" }, { value: "today", label: "Today" }, { value: "review", label: "Review" }]} />
        </>}
      />
      {tab === "week" && <WeekView weekStart={weekStart} />}
      {tab === "today" && <TodayView />}
      {tab === "review" && <ReviewView weekStart={weekStart} />}
    </>
  );
}

// ======================= WEEK =======================
function WeekView({ weekStart }: { weekStart: string }) {
  const { projects, tasks, milestones, waiting_items, weekly_plans, settings } = useStore();
  const openTask = useDialogs((s) => s.openTask);
  const days = weekDays(weekStart);
  const today = todayStr();
  const plan = weekly_plans.find((w) => w.week_start === weekStart) ?? getOrCreateWeek(weekStart);
  const [deliv, setDeliv] = React.useState("");
  const [over, setOver] = React.useState<string | null>(null);
  const [trayFilter, setTrayFilter] = React.useState<"priority" | "all">("priority");

  const candidates = projects.filter((p) => !["archived", "completed"].includes(statusKind(settings, p.status)));
  const weekTasks = tasks.filter((t) => t.scheduled_date && t.scheduled_date >= days[0] && t.scheduled_date <= days[6]);
  const prioIds = plan.priority_project_ids;
  const tray = tasks.filter((t) => isOpenTask(t) && t.status !== "waiting" && !t.scheduled_date && (trayFilter === "all" || !prioIds.length || (t.project_id && prioIds.includes(t.project_id)))).sort(sortByImportance);
  const totalEffort = weekTasks.filter((t) => t.status !== "cancelled").reduce((s, t) => s + (t.effort_hours ?? 0), 0);
  const doneCount = weekTasks.filter((t) => t.status === "done").length;
  const unfinishedPast = weekTasks.filter((t) => isOpenTask(t) && t.scheduled_date! < today);

  const setPriority = (slot: 0 | 1, id: string) => {
    const next = [...prioIds];
    if (id) next[slot] = id; else next.splice(slot, 1);
    saveWeek(weekStart, { priority_project_ids: Array.from(new Set(next.filter(Boolean))).slice(0, 2) });
  };
  const addDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliv.trim()) return;
    saveWeek(weekStart, { deliverables: [...plan.deliverables, { id: uid(), text: deliv.trim(), done: false }] });
    setDeliv("");
  };
  const drop = (date: string | null) => (e: React.DragEvent) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (id) updateTask(id, { scheduled_date: date });
  };
  const dragStart = (t: Task) => (e: React.DragEvent) => { e.dataTransfer.setData("text/task-id", t.id); e.dataTransfer.effectAllowed = "move"; };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Top research priorities" subtitle="Choose at most two — protect them" />
          <div className="space-y-2 px-4 pb-4">
            {[0, 1].map((slot) => {
              const p = projects.find((x) => x.id === prioIds[slot]);
              return (
                <div key={slot} className="flex items-center gap-2">
                  <span className="w-4 font-serif text-lg text-muted-foreground">{slot + 1}</span>
                  {p && <ProjectIcon project={p} size={18} />}
                  <Select value={prioIds[slot] ?? ""} onChange={(e) => setPriority(slot as 0 | 1, e.target.value)} disabled={slot === 1 && !prioIds[0]} className="h-8 flex-1" aria-label={`Priority ${slot + 1}`}>
                    <option value="">{slot === 1 && !prioIds[0] ? "Choose priority 1 first" : "Choose a project…"}</option>
                    {candidates.filter((c) => c.id === prioIds[slot] || !prioIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </Select>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <CardHeader title="Deliverables" subtitle={`${plan.deliverables.filter((d) => d.done).length} of ${plan.deliverables.length} complete`} />
          <div className="px-4 pb-4">
            {plan.deliverables.map((d) => (
              <div key={d.id} className="group flex items-center gap-2 py-1">
                <Checkbox checked={d.done} onChange={(v) => saveWeek(weekStart, { deliverables: plan.deliverables.map((x) => x.id === d.id ? { ...x, done: v } : x) })} />
                <span className={cn("flex-1 text-[13px]", d.done && "text-muted-foreground line-through")}>{d.text}</span>
                <button className="opacity-0 group-hover:opacity-100" onClick={() => saveWeek(weekStart, { deliverables: plan.deliverables.filter((x) => x.id !== d.id) })} aria-label="Remove deliverable"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ))}
            <form onSubmit={addDeliverable} className="mt-1 flex gap-1.5">
              <Input value={deliv} onChange={(e) => setDeliv(e.target.value)} placeholder="e.g. Full draft of theory section" className="h-7 text-xs" />
              <Button type="submit" size="icon-sm" variant="secondary" aria-label="Add deliverable"><Plus /></Button>
            </form>
          </div>
        </Card>
        <Card>
          <CardHeader title="Workload" subtitle="Estimated effort of scheduled tasks" />
          <div className="px-4 pb-4">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl tabular-nums">{totalEffort.toFixed(totalEffort % 1 ? 1 : 0)}h</span>
              <span className="text-xs text-muted-foreground">of {plan.capacity_hours ?? "—"}h available</span>
            </div>
            {plan.capacity_hours ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", totalEffort > plan.capacity_hours ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.min(100, (totalEffort / plan.capacity_hours) * 100)}%` }} />
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              <Field label="Research hours available this week" className="flex-1">
                <Input type="number" min={0} step={1} defaultValue={plan.capacity_hours ?? ""} key={plan.id + String(plan.capacity_hours)}
                  onBlur={(e) => saveWeek(weekStart, { capacity_hours: e.target.value === "" ? null : Number(e.target.value) })} className="h-7 w-24" />
              </Field>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{doneCount} of {weekTasks.length} scheduled tasks done{weekTasks.some((t) => !t.effort_hours) ? " · some tasks have no estimate" : ""}</p>
          </div>
        </Card>
      </div>

      {unfinishedPast.length > 0 && weekStart <= today && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-2.5 text-[13px]">
          <Undo2 className="h-4 w-4 text-warning" />
          {unfinishedPast.length} unfinished task{unfinishedPast.length > 1 ? "s" : ""} from earlier days.
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => {
            const target = days.includes(today) ? today : toDateStr(addDays(parseDate(days[6])!, 1));
            rescheduleTasks(unfinishedPast.map((t) => t.id), target);
            toast.success(`Moved to ${fmtDate(target, "EEE MMM d")}`, { description: "The same tasks were rescheduled — nothing was duplicated." });
          }}>Carry over to {days.includes(today) ? "today" : "next week"}</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1fr_260px]">
        <div className="scroll-thin grid grid-cols-1 gap-2 overflow-x-auto sm:grid-cols-7 sm:min-w-[900px]">
          {days.map((d) => {
            const list = weekTasks.filter((t) => t.scheduled_date === d).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || sortByImportance(a, b));
            const effort = list.filter((t) => t.status !== "cancelled").reduce((s, t) => s + (t.effort_hours ?? 0), 0);
            const dueHere = tasks.filter((t) => t.due_date === d && isOpenTask(t));
            const msHere = milestones.filter((m) => m.due_date === d && !m.completed_on);
            const fuHere = waiting_items.filter((w) => w.follow_up_on === d && waitingActive(w));
            const isToday = d === today;
            return (
              <div key={d}
                onDragOver={(e) => { e.preventDefault(); setOver(d); }} onDragLeave={() => setOver(null)} onDrop={drop(d)}
                data-day={d}
                className={cn("surface flex min-h-[320px] flex-col rounded-lg border bg-card", isToday && "ring-1 ring-primary/40", over === d && "border-primary/60 bg-primary/5")}>
                <div className="border-b px-2.5 py-2">
                  <div className="flex items-baseline justify-between">
                    <span className={cn("text-xs font-semibold", isToday && "text-primary")}>{format(parseDate(d)!, "EEE")}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{format(parseDate(d)!, "d")}</span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                    <span>{effort ? `${effort}h` : "—"}</span>
                    <span>{list.filter((t) => t.status === "done").length}/{list.length} done</span>
                  </div>
                </div>
                {(dueHere.length > 0 || msHere.length > 0 || fuHere.length > 0) && (
                  <div className="space-y-0.5 border-b px-2 py-1.5">
                    {msHere.map((m) => <div key={m.id} className="flex items-center gap-1 truncate text-[10.5px] text-primary"><Flag className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{m.title}</span></div>)}
                    {dueHere.map((t) => <button key={t.id} onClick={() => openTask(t)} className="flex w-full items-center gap-1 truncate text-left text-[10.5px] text-destructive/90"><CalendarClock className="h-2.5 w-2.5 shrink-0" /><span className="truncate">Due: {t.title}</span></button>)}
                    {fuHere.map((w) => <Link key={w.id} href="/waiting" className="flex items-center gap-1 truncate text-[10.5px] text-warning"><Hourglass className="h-2.5 w-2.5 shrink-0" /><span className="truncate">Follow up: {w.waiting_for}</span></Link>)}
                  </div>
                )}
                <div className="flex-1 space-y-1 p-1.5">
                  {list.map((t) => <MiniTask key={t.id} t={t} onDragStart={dragStart(t)} />)}
                  <button onClick={() => openTask({ scheduled_date: d })} className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-[11px] text-muted-foreground opacity-60 hover:bg-accent hover:opacity-100"><Plus className="h-3 w-3" />Add</button>
                </div>
              </div>
            );
          })}
        </div>
        <Card className={cn("flex max-h-[420px] flex-col 2xl:max-h-[640px]", over === "tray" && "border-primary/60")}
          onDragOver={(e: React.DragEvent) => { e.preventDefault(); setOver("tray"); }} onDragLeave={() => setOver(null)} onDrop={drop(null)}>
          <CardHeader title="Unscheduled" subtitle="Drag onto a day" action={
            <Segmented value={trayFilter} onChange={setTrayFilter} options={[{ value: "priority", label: "Priorities" }, { value: "all", label: "All" }]} />
          } />
          <div className="scroll-thin flex-1 space-y-1 overflow-y-auto px-2 pb-2">
            {tray.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">{prioIds.length && trayFilter === "priority" ? "No unscheduled tasks in your priority projects." : "Every open task is scheduled."}</p>}
            {tray.map((t) => <MiniTask key={t.id} t={t} showProject onDragStart={dragStart(t)} schedulable={days} />)}
          </div>
        </Card>
      </div>
      <p className="text-[11px] text-muted-foreground">Dragging a task changes its scheduled work date — the same task appears in every view, nothing is copied.</p>
    </div>
  );
}

function MiniTask({ t, onDragStart, showProject, schedulable }: { t: Task; onDragStart: (e: React.DragEvent) => void; showProject?: boolean; schedulable?: string[] }) {
  const openTask = useDialogs((s) => s.openTask);
  const p = useStore((s) => s.projects.find((x) => x.id === t.project_id));
  const done = t.status === "done";
  const LoadI = t.cognitive_load === "deep" ? Brain : t.cognitive_load === "light" ? Coffee : Focus;
  return (
    <div draggable onDragStart={onDragStart} data-task-id={t.id}
      className={cn("group cursor-grab rounded-md border bg-card px-2 py-1.5 shadow-[0_1px_0_rgb(0_0_0/0.03)] hover:border-foreground/20 active:cursor-grabbing", done && "opacity-60")}>
      <div className="flex items-start gap-1.5">
        <Checkbox checked={done} onChange={(v) => updateTask(t.id, { status: v ? "done" : "next" })} className="mt-[1px] h-3.5 w-3.5" label="Toggle done" />
        <button onClick={() => openTask(t)} className={cn("min-w-0 flex-1 text-left text-[12px] leading-snug", done && "line-through")}>{t.title}</button>
      </div>
      <div className="mt-1 flex items-center gap-1.5 pl-5 text-[10px] text-muted-foreground">
        <PriorityIcon p={t.priority} />
        <LoadI className={cn("h-3 w-3", t.cognitive_load === "deep" && "text-primary")} />
        {t.effort_hours ? <span>{t.effort_hours}h</span> : null}
        {p && <span className={cn("truncate", !showProject && "hidden xl:inline")}>{p.title}</span>}
        {isTaskOverdue(t) && <span className="text-destructive">overdue</span>}
      </div>
      {schedulable && (
        <Select aria-label="Schedule for" value="" onChange={(e) => e.target.value && updateTask(t.id, { scheduled_date: e.target.value })} className="mt-1.5 h-6 text-[11px] sm:hidden">
          <option value="">Schedule…</option>
          {schedulable.map((d) => <option key={d} value={d}>{fmtDate(d, "EEE MMM d")}</option>)}
        </Select>
      )}
    </div>
  );
}

// ======================= TODAY =======================
export function TodayView() {
  const { tasks, milestones, weekly_plans, projects, waiting_items } = useStore();
  const openTask = useDialogs((s) => s.openTask);
  const today = todayStr();
  const plan = weekly_plans.find((w) => w.week_start === weekStartStr());
  const prio = (plan?.priority_project_ids ?? []).map((id) => projects.find((p) => p.id === id)).filter(Boolean) as typeof projects;
  const todays = tasks.filter((t) => t.scheduled_date === today || (isTaskOverdue(t) && (!t.scheduled_date || t.scheduled_date < today)));
  const open = todays.filter(isOpenTask).sort(sortByImportance);
  const doneToday = tasks.filter((t) => t.status === "done" && t.completed_at && toDateStr(new Date(t.completed_at)) === today);
  const in7 = toDateStr(addDays(new Date(), 7));
  const upcoming = [
    ...tasks.filter((t) => isOpenTask(t) && t.due_date && t.due_date >= today && t.due_date <= in7).map((t) => ({ id: t.id, date: t.due_date!, title: t.title, onClick: () => openTask(t), ms: false })),
    ...milestones.filter((m) => !m.completed_on && m.due_date && m.due_date >= today && m.due_date <= in7).map((m) => ({ id: m.id, date: m.due_date!, title: m.title, onClick: () => {}, ms: true })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));
  const followups = waiting_items.filter((w) => waitingActive(w) && w.follow_up_on && w.follow_up_on <= today);
  const effort = open.reduce((s, t) => s + (t.effort_hours ?? 0), 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {prio.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prio.map((p, i) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="surface flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-[12.5px] hover:border-foreground/20">
                <Target className="h-3.5 w-3.5 text-primary" /><span className="text-muted-foreground">Priority {i + 1}</span><ProjectIcon project={p} size={14} /><span className="font-medium">{p.title}</span>
              </Link>
            ))}
          </div>
        )}
        {open.length === 0 && doneToday.length === 0 ? (
          <EmptyState icon={<CalendarClock />} title="Nothing scheduled for today"
            action={<div className="flex gap-2"><Button onClick={() => openTask({ scheduled_date: today })}><Plus />Add a task for today</Button><Link href="/planner" className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-[13px] font-medium shadow-sm hover:bg-accent">Open planner</Link></div>}>
            Pick one deep-work task from your priorities and schedule it here.
          </EmptyState>
        ) : COGNITIVE_LOADS.map((l) => {
          const list = open.filter((t) => t.cognitive_load === l.key);
          const Icon = l.key === "deep" ? Brain : l.key === "medium" ? Focus : Coffee;
          return (
            <Card key={l.key}>
              <CardHeader title={<span className="flex items-center gap-2"><Icon className={cn("h-4 w-4", l.key === "deep" ? "text-primary" : "text-muted-foreground")} />{l.label}</span>} subtitle={l.hint}
                action={<Button size="icon-sm" variant="ghost" aria-label={`Add ${l.label} task`} onClick={() => openTask({ scheduled_date: today, cognitive_load: l.key })}><Plus /></Button>} />
              <div className="px-2 pb-2">
                {list.length === 0 ? <p className="px-2 pb-2 text-xs text-muted-foreground">—</p> : list.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </Card>
          );
        })}
        {doneToday.length > 0 && (
          <Card>
            <CardHeader title={`Completed today · ${doneToday.length}`} />
            <div className="px-2 pb-2">{doneToday.map((t) => <TaskRow key={t.id} task={t} compact />)}</div>
          </Card>
        )}
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Today at a glance" />
          <div className="grid grid-cols-3 gap-2 px-4 pb-4 text-center">
            <div className="rounded-md bg-muted/60 py-2"><div className="font-serif text-xl tabular-nums">{open.length}</div><div className="text-[10px] text-muted-foreground">open</div></div>
            <div className="rounded-md bg-muted/60 py-2"><div className="font-serif text-xl tabular-nums">{doneToday.length}</div><div className="text-[10px] text-muted-foreground">done</div></div>
            <div className="rounded-md bg-muted/60 py-2"><div className="font-serif text-xl tabular-nums">{effort || "—"}{effort ? "h" : ""}</div><div className="text-[10px] text-muted-foreground">planned</div></div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Upcoming deadlines" subtitle="Next 7 days" />
          <div className="px-2 pb-2">
            {upcoming.length === 0 ? <p className="px-2 pb-2 text-xs text-muted-foreground">None.</p> : upcoming.map((u) => (
              <button key={u.id} onClick={u.onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/60">
                {u.ms ? <Flag className="h-3.5 w-3.5 text-primary" /> : <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="flex-1 truncate text-[13px]">{u.title}</span><DueLabel date={u.date} />
              </button>
            ))}
          </div>
        </Card>
        {followups.length > 0 && (
          <Card>
            <CardHeader title="Follow-ups due" action={<Link href="/waiting" className="text-xs text-muted-foreground hover:text-foreground">Tracker</Link>} />
            <div className="px-4 pb-4">{followups.map((w) => <div key={w.id} className="flex items-center gap-2 py-1 text-[13px]"><Hourglass className="h-3.5 w-3.5 text-warning" /><span className="flex-1 truncate">{w.waiting_for}</span><DueLabel date={w.follow_up_on} /></div>)}</div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ======================= REVIEW =======================
function ReviewView({ weekStart }: { weekStart: string }) {
  const { tasks, projects, activity_log, weekly_plans } = useStore();
  const days = weekDays(weekStart);
  const end = toDateStr(addDays(parseDate(days[6])!, 1));
  const plan = weekly_plans.find((w) => w.week_start === weekStart) ?? getOrCreateWeek(weekStart);
  const [r, setR] = React.useState<WeeklyReview>(plan.review ?? {});
  React.useEffect(() => setR(plan.review ?? {}), [plan.id, plan.review]);

  const inWeek = (iso: string | null) => !!iso && toDateStr(new Date(iso)) >= days[0] && toDateStr(new Date(iso)) < end;
  const completed = tasks.filter((t) => t.status === "done" && inWeek(t.completed_at));
  const progressed = projects.map((p) => ({ p, n: activity_log.filter((a) => a.project_id === p.id && inWeek(a.created_at)).length, done: completed.filter((t) => t.project_id === p.id).length }))
    .filter((x) => x.n > 0 || x.done > 0).sort((a, b) => b.done - a.done || b.n - a.n);
  const unfinished = tasks.filter((t) => isOpenTask(t) && t.scheduled_date && t.scheduled_date >= days[0] && t.scheduled_date <= days[6]);
  const nextMonday = toDateStr(addDays(parseDate(days[6])!, 1));

  function save() {
    saveWeek(weekStart, { review: r, reviewed_at: new Date().toISOString() });
    toast.success("Weekly review saved");
  }

  const prompts: { k: keyof WeeklyReview; q: string; ph: string }[] = [
    { k: "completed", q: "What did I complete?", ph: "Concrete outputs — sections drafted, models run, data obtained…" },
    { k: "progressed", q: "Which projects progressed?", ph: "And which ones quietly stalled?" },
    { k: "obstacles", q: "What prevented progress?", ph: "Waiting on others, unclear next steps, too much context switching…" },
    { k: "carry_over", q: "Which tasks should carry over?", ph: "Use the list on the right to move them." },
    { k: "next_priorities", q: "What should I prioritize next week?", ph: "No more than two projects." },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Reflection" subtitle={plan.reviewed_at ? `Last saved ${fmtDate(plan.reviewed_at.slice(0, 10))}` : "Five short questions — ten minutes is enough"}
          action={<Button size="sm" onClick={save}><Save />Save review</Button>} />
        <div className="space-y-4 px-4 pb-4">
          {prompts.map((x) => (
            <Field key={x.k} label={x.q}>
              <Textarea value={r[x.k] ?? ""} onChange={(e) => setR((o) => ({ ...o, [x.k]: e.target.value }))} placeholder={x.ph} className="min-h-[64px]" />
            </Field>
          ))}
          <div className="flex justify-end"><Button onClick={save}><Save />Save review</Button></div>
        </div>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title={`Completed · ${completed.length}`} subtitle="Tasks finished this week" action={completed.length > 0 && !r.completed ? <Button size="sm" variant="ghost" onClick={() => setR((o) => ({ ...o, completed: completed.map((t) => `• ${t.title}`).join("\n") }))}>Insert</Button> : undefined} />
          <div className="scroll-thin max-h-60 overflow-y-auto px-2 pb-2">{completed.length === 0 ? <p className="px-2 pb-2 text-xs text-muted-foreground">Nothing completed this week yet.</p> : completed.map((t) => <TaskRow key={t.id} task={t} compact />)}</div>
        </Card>
        <Card>
          <CardHeader title="Projects that moved" />
          <div className="px-4 pb-4">
            {progressed.length === 0 ? <p className="text-xs text-muted-foreground">No recorded activity.</p> : progressed.map(({ p, n, done }) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 py-1 text-[13px] hover:text-primary">
                <ProjectIcon project={p} size={14} /><span className="flex-1 truncate">{p.title}</span><span className="text-[11px] text-muted-foreground">{done} done · {n} updates</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title={`Unfinished · ${unfinished.length}`} subtitle="Scheduled this week, still open"
            action={unfinished.length > 0 ? <Button size="sm" variant="secondary" onClick={() => { rescheduleTasks(unfinished.map((t) => t.id), nextMonday); toast.success(`Moved ${unfinished.length} task(s) to ${fmtDate(nextMonday)}`); }}>Move all to next week</Button> : undefined} />
          <div className="px-2 pb-2">
            {unfinished.length === 0 ? <p className="px-2 pb-2 text-xs text-muted-foreground">Nothing left over.</p> : unfinished.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1"><TaskRow task={t} compact /></div>
                <Button size="icon-sm" variant="ghost" title={`Move to ${fmtDate(nextMonday)}`} aria-label="Carry over to next week" onClick={() => updateTask(t.id, { scheduled_date: nextMonday })}><CornerDownRight /></Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
