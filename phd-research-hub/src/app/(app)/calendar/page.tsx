"use client";
import * as React from "react";
import Link from "next/link";
import { addDays, addMonths, endOfMonth, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, Flag, Hourglass, Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/bits";
import { TaskRow } from "@/components/task-row";
import { useDialogs } from "@/components/dialog-store";
import { updateTask } from "@/lib/actions";
import { isOpenTask, isTaskOverdue, statusKind, waitingActive } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { cn, fmtDate, parseDate, toDateStr, todayStr } from "@/lib/utils";

type Layer = "scheduled" | "due" | "milestones" | "followups" | "projects";
const LAYERS: { key: Layer; label: string; dot: string }[] = [
  { key: "scheduled", label: "Scheduled work", dot: "bg-foreground/40" },
  { key: "due", label: "Task deadlines", dot: "bg-destructive" },
  { key: "milestones", label: "Milestones", dot: "bg-primary" },
  { key: "followups", label: "Follow-ups", dot: "bg-warning" },
  { key: "projects", label: "Project targets", dot: "bg-success" },
];

export default function CalendarPage() {
  const { tasks, milestones, waiting_items, projects, settings } = useStore();
  const { openTask, openMilestone, openWaiting } = useDialogs();
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [layers, setLayers] = React.useState<Set<Layer>>(new Set(LAYERS.map((l) => l.key)));
  const [selected, setSelected] = React.useState(todayStr());
  const [over, setOver] = React.useState<string | null>(null);
  const today = todayStr();

  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfMonth(month);
  const days: Date[] = [];
  for (let d = start; d <= end || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);

  type Ev = { id: string; layer: Layer; title: string; done?: boolean; overdue?: boolean; onClick: () => void; taskId?: string };
  const byDay = React.useMemo(() => {
    const m = new Map<string, Ev[]>();
    const add = (d: string | null, e: Ev) => { if (!d) return; m.set(d, [...(m.get(d) ?? []), e]); };
    for (const t of tasks) {
      if (t.status === "cancelled") continue;
      if (t.scheduled_date) add(t.scheduled_date, { id: "s" + t.id, layer: "scheduled", title: t.title, done: t.status === "done", onClick: () => openTask(t), taskId: t.id });
      if (t.due_date && isOpenTask(t)) add(t.due_date, { id: "d" + t.id, layer: "due", title: t.title, overdue: isTaskOverdue(t), onClick: () => openTask(t) });
    }
    for (const ms of milestones) if (ms.due_date) add(ms.due_date, { id: "m" + ms.id, layer: "milestones", title: ms.title, done: !!ms.completed_on, onClick: () => openMilestone(ms) });
    for (const w of waiting_items) if (w.follow_up_on && waitingActive(w)) add(w.follow_up_on, { id: "w" + w.id, layer: "followups", title: `Follow up: ${w.waiting_for}`, onClick: () => openWaiting(w) });
    for (const p of projects) if (p.target_date && statusKind(settings, p.status) !== "archived") add(p.target_date, { id: "p" + p.id, layer: "projects", title: `${p.title} target`, onClick: () => location.assign(`/projects/${p.id}`) });
    return m;
  }, [tasks, milestones, waiting_items, projects, settings, openTask, openMilestone, openWaiting]);

  const evs = (d: string) => (byDay.get(d) ?? []).filter((e) => layers.has(e.layer));
  const toggle = (l: Layer) => setLayers((s) => { const n = new Set(s); if (n.has(l)) n.delete(l); else n.add(l); return n; });
  const dot = (l: Layer) => LAYERS.find((x) => x.key === l)!.dot;
  const selEvents = evs(selected);
  const selTasks = tasks.filter((t) => t.scheduled_date === selected || (t.due_date === selected && isOpenTask(t)));

  return (
    <>
      <PageHeader title="Calendar" subtitle="Scheduled work, deadlines, milestones and follow-ups in one view"
        actions={<div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month"><ChevronLeft /></Button>
          <span className="w-36 text-center font-serif text-lg">{format(month, "MMMM yyyy")}</span>
          <Button size="icon" variant="ghost" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month"><ChevronRight /></Button>
          <Button size="sm" variant="secondary" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(today); }}>Today</Button>
        </div>} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {LAYERS.map((l) => (
          <button key={l.key} onClick={() => toggle(l.key)} aria-pressed={layers.has(l.key)}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors", layers.has(l.key) ? "bg-card text-foreground" : "text-muted-foreground opacity-60")}>
            <span className={cn("h-2 w-2 rounded-full", l.dot)} />{l.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b text-center text-[11px] text-muted-foreground">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const ds = toDateStr(d);
              const list = evs(ds);
              const inMonth = isSameMonth(d, month);
              return (
                <div key={ds} role="button" tabIndex={0} onClick={() => setSelected(ds)} onKeyDown={(e) => e.key === "Enter" && setSelected(ds)}
                  onDragOver={(e) => { e.preventDefault(); setOver(ds); }} onDragLeave={() => setOver(null)}
                  onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/task-id"); if (id) updateTask(id, { scheduled_date: ds }); }}
                  className={cn("min-h-[104px] cursor-pointer border-b border-r p-1.5 text-left transition-colors [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-muted/30", selected === ds && "bg-primary/5 ring-1 ring-inset ring-primary/40", over === ds && "bg-primary/10")}>
                  <div className={cn("mb-1 grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums", ds === today ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "" : "text-muted-foreground/60")}>{format(d, "d")}</div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <div key={e.id} draggable={!!e.taskId} onDragStart={(ev) => e.taskId && ev.dataTransfer.setData("text/task-id", e.taskId)}
                        onClick={(ev) => { ev.stopPropagation(); e.onClick(); }}
                        className={cn("flex items-center gap-1 truncate rounded px-1 py-px text-[10.5px] leading-4 hover:bg-accent", e.done && "text-muted-foreground line-through", e.overdue && "text-destructive")}>
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot(e.layer))} /><span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {list.length > 3 && <div className="px-1 text-[10px] text-muted-foreground">+{list.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="h-fit">
          <CardHeader title={format(parseDate(selected)!, "EEEE, MMMM d")} subtitle={selected === today ? "Today" : fmtDate(selected)}
            action={<Button size="icon-sm" variant="ghost" onClick={() => openTask({ scheduled_date: selected })} aria-label="Add task on this day"><Plus /></Button>} />
          <div className="px-2 pb-3">
            {selTasks.length === 0 && selEvents.filter((e) => e.layer !== "scheduled" && e.layer !== "due").length === 0 && <p className="px-2 text-xs text-muted-foreground">Nothing on this day.</p>}
            {selTasks.map((t) => <TaskRow key={t.id} task={t} />)}
            {selEvents.filter((e) => e.layer === "milestones" || e.layer === "followups" || e.layer === "projects").map((e) => (
              <button key={e.id} onClick={e.onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent/60">
                {e.layer === "milestones" ? <Flag className="h-3.5 w-3.5 text-primary" /> : e.layer === "followups" ? <Hourglass className="h-3.5 w-3.5 text-warning" /> : <Target className="h-3.5 w-3.5 text-success" />}
                <span className={cn("truncate", e.done && "line-through text-muted-foreground")}>{e.title}</span>
              </button>
            ))}
          </div>
          <p className="border-t px-4 py-2 text-[11px] text-muted-foreground"><CalendarClock className="mr-1 inline h-3 w-3" />Drag scheduled tasks between days to reschedule. <Link href="/planner" className="text-primary hover:underline">Weekly planner</Link></p>
        </Card>
      </div>
    </>
  );
}
