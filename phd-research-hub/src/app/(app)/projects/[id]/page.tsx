"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, CalendarDays, Check, ExternalLink, Flag, Hourglass, ImagePlus, Link2, NotebookPen, Pencil, Plus, Trash2, Users, X, CircleDot, History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, ProgressBar } from "@/components/ui/misc";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DueLabel, ProjectCover, ProjectIcon, TaskStatusBadge } from "@/components/bits";
import { TaskRow } from "@/components/task-row";
import { ProjectActions } from "@/components/project-actions";
import { useDialogs } from "@/components/dialog-store";
import { createTask, logActivity, removeDependency, resolveWaiting, updateMilestone, updateProject } from "@/lib/actions";
import { MILESTONE_KINDS, PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import {
  isOpenTask, isProjectOverdue, nextActionable, phasesOf, projectProgress, sortByImportance, statusesOf, waitingActive, followUpState,
} from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { cn, fmtDate, timeAgo, todayStr, uid } from "@/lib/utils";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const { projects, tasks, milestones, task_dependencies, waiting_items, activity_log, settings } = useStore();
  const { openProject, openTask, openMilestone, openWaiting } = useDialogs();
  const p = projects.find((x) => x.id === id);

  if (!p) {
    return (
      <EmptyState title="Project not found" action={<Button variant="secondary" onClick={() => router.push("/projects")}><ArrowLeft />All projects</Button>}>
        It may have been deleted on another device.
      </EmptyState>
    );
  }

  const ptasks = tasks.filter((t) => t.project_id === p.id);
  const pms = milestones.filter((m) => m.project_id === p.id).sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1);
  const pwait = waiting_items.filter((w) => w.project_id === p.id);
  const prog = projectProgress(p, tasks, milestones, settings);
  const next = nextActionable(p.id, tasks, task_dependencies);
  const overdue = isProjectOverdue(p, settings);
  const setTab = (t: string) => router.replace(`/projects/${p.id}?tab=${t}`, { scroll: false });

  return (
    <div>
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3 w-3" />Projects</Link>
      <div className="surface overflow-hidden rounded-xl border bg-card">
        <ProjectCover project={p} className="h-36 md:h-44">
          <div className="absolute right-3 top-3 flex gap-1.5">
            <Button size="sm" variant="secondary" className="bg-card/85 backdrop-blur" onClick={() => openProject(p, "appearance")}><ImagePlus />{p.cover_path ? "Change cover" : "Add cover"}</Button>
          </div>
        </ProjectCover>
        <div className="relative px-5 pb-5 md:px-7">
          <div className="-mt-7 mb-3 inline-block rounded-xl bg-card p-1.5 shadow-sm ring-1 ring-border"><ProjectIcon project={p} size={40} /></div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="page-title">{p.title}</h1>
              {p.research_question && <p className="mt-1.5 max-w-3xl font-serif text-[15px] italic leading-relaxed text-muted-foreground">{p.research_question}</p>}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" onClick={() => openProject(p)}><Pencil />Edit</Button>
              <ProjectActions project={p} onDeleted={() => router.push("/projects")} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">Phase
              <Select value={p.phase} onChange={(e) => updateProject(p.id, { phase: e.target.value })} className="h-7 w-auto text-xs" aria-label="Research phase">
                {phasesOf(settings).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </Select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">Status
              <Select value={p.status} onChange={(e) => updateProject(p.id, { status: e.target.value })} className="h-7 w-auto text-xs" aria-label="Activity status">
                {statusesOf(settings).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </Select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">Priority
              <Select value={p.priority} onChange={(e) => updateProject(p.id, { priority: e.target.value as typeof p.priority })} className="h-7 w-auto text-xs" aria-label="Priority">
                {PRIORITIES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </Select>
            </label>
            {p.category && <Badge tone="outline">{p.category}</Badge>}
            {overdue && <Badge tone="danger">Past target date</Badge>}
            <span className="ml-auto text-[11px] text-muted-foreground">Last activity {timeAgo(p.last_activity_at)}</span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks <span className="text-[11px] text-muted-foreground">{ptasks.filter(isOpenTask).length}</span></TabsTrigger>
          <TabsTrigger value="milestones">Milestones <span className="text-[11px] text-muted-foreground">{pms.filter((m) => m.completed_on).length}/{pms.length}</span></TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="notes">Notes & links</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ---------------- Overview ---------------- */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card>
                <CardHeader title="About this project" />
                <div className="space-y-3 px-4 pb-4 text-[13px] leading-relaxed">
                  {p.description ? <p>{p.description}</p> : <p className="text-muted-foreground">No description yet. <button className="text-primary hover:underline" onClick={() => openProject(p)}>Add one</button>.</p>}
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2 text-xs sm:grid-cols-4">
                    <div><dt className="text-muted-foreground">Start</dt><dd>{fmtDate(p.start_date) || "—"}</dd></div>
                    <div><dt className="text-muted-foreground">Target completion</dt><dd>{fmtDate(p.target_date) || "—"}</dd></div>
                    <div className="col-span-2"><dt className="text-muted-foreground">Collaborators / advisors</dt><dd className="flex items-center gap-1">{p.collaborators ? <><Users className="h-3 w-3 text-muted-foreground" />{p.collaborators}</> : "—"}</dd></div>
                  </dl>
                </div>
              </Card>
              <Card>
                <CardHeader title="Open tasks" subtitle="Ordered by importance" action={<Button size="sm" variant="ghost" onClick={() => setTab("tasks")}>All tasks</Button>} />
                <div className="px-2 pb-2">
                  {ptasks.filter((t) => isOpenTask(t) && !t.parent_id).sort(sortByImportance).slice(0, 6).map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}
                  <QuickAdd projectId={p.id} />
                </div>
              </Card>
            </div>
            <div className="space-y-4">
              <ProgressCard projectId={p.id} />
              <Card>
                <CardHeader title="Next action" />
                <div className="px-4 pb-4">
                  {next ? (
                    <button onClick={() => openTask(next)} className="w-full rounded-md border p-3 text-left hover:bg-accent/50">
                      <div className="text-[13px] font-medium">{next.title}</div>
                      <div className="mt-1 flex gap-2"><TaskStatusBadge s={next.status} />{next.due_date && <DueLabel date={next.due_date} />}</div>
                    </button>
                  ) : <p className="text-xs text-muted-foreground">No actionable task. Everything is done, waiting or blocked.</p>}
                </div>
              </Card>
              <Card>
                <CardHeader title="Waiting on" action={<Button size="icon-sm" variant="ghost" onClick={() => openWaiting({ project_id: p.id })} aria-label="Add waiting item"><Plus /></Button>} />
                <div className="px-4 pb-4">
                  {pwait.filter(waitingActive).length === 0 ? <p className="text-xs text-muted-foreground">Nothing external.</p> :
                    pwait.filter(waitingActive).map((w) => (
                      <div key={w.id} className="flex items-center gap-2 py-1">
                        <Hourglass className="h-3.5 w-3.5 text-warning" />
                        <button className="min-w-0 flex-1 truncate text-left text-[13px] hover:text-primary" onClick={() => openWaiting(w)}>{w.waiting_for}</button>
                        {w.follow_up_on && <DueLabel date={w.follow_up_on} />}
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---------------- Tasks ---------------- */}
        <TabsContent value="tasks"><ProjectTasks projectId={p.id} /></TabsContent>

        {/* ---------------- Milestones ---------------- */}
        <TabsContent value="milestones">
          <div className="mb-3 flex justify-between">
            <p className="text-xs text-muted-foreground">Milestones mark meaningful research outputs — submissions, decisions and revision deadlines included.</p>
            <Button size="sm" onClick={() => openMilestone({ project_id: p.id })}><Plus />Milestone</Button>
          </div>
          {pms.length === 0 ? <EmptyState icon={<Flag />} title="No milestones yet">Add milestones such as “IRB approved”, “Data assembled”, or a manuscript submission.</EmptyState> : (
            <Card>
              {pms.map((m) => {
                const linked = tasks.filter((t) => t.milestone_id === m.id);
                return (
                  <div key={m.id} className="group flex items-start gap-3 border-b px-4 py-3 last:border-0">
                    <Checkbox className="mt-0.5" checked={!!m.completed_on} onChange={(v) => updateMilestone(m.id, { completed_on: v ? todayStr() : null })} label="Toggle milestone" />
                    <button className="min-w-0 flex-1 text-left" onClick={() => openMilestone(m)}>
                      <div className={cn("text-[13px] font-medium", m.completed_on && "text-muted-foreground line-through")}>{m.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{MILESTONE_KINDS.find((k) => k.key === m.kind)?.label}</span>
                        {m.venue && <span>{m.venue}</span>}
                        {m.decision && <Badge tone={m.decision === "Accept" ? "success" : m.decision.includes("revision") ? "warning" : "neutral"}>{m.decision}</Badge>}
                        {linked.length > 0 && <span>{linked.filter((t) => t.status === "done").length}/{linked.length} linked tasks</span>}
                        {m.completed_on && <span className="text-success">Completed {fmtDate(m.completed_on)}</span>}
                      </div>
                    </button>
                    {m.due_date && !m.completed_on && <DueLabel date={m.due_date} />}
                  </div>
                );
              })}
            </Card>
          )}
        </TabsContent>

        {/* ---------------- Dependencies ---------------- */}
        <TabsContent value="dependencies">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Task dependencies" subtitle="Tasks that cannot start until another is done" />
              <div className="px-4 pb-4">
                {(() => {
                  const ids = new Set(ptasks.map((t) => t.id));
                  const list = task_dependencies.filter((d) => ids.has(d.task_id) || ids.has(d.depends_on_id));
                  if (!list.length) return <p className="text-xs text-muted-foreground">None. Add them from a task's editor (“Depends on”).</p>;
                  return list.map((d) => {
                    const a = tasks.find((t) => t.id === d.task_id), b = tasks.find((t) => t.id === d.depends_on_id);
                    if (!a || !b) return null;
                    const met = !isOpenTask(b);
                    return (
                      <div key={d.id} className="group flex items-center gap-2 border-b py-2 text-[13px] last:border-0">
                        <button className="truncate hover:text-primary" onClick={() => openTask(b)}>{b.title}</button>
                        <Link2 className={cn("h-3.5 w-3.5 shrink-0", met ? "text-success" : "text-warning")} />
                        <button className="truncate hover:text-primary" onClick={() => openTask(a)}>{a.title}</button>
                        <span className={cn("ml-auto shrink-0 text-[11px]", met ? "text-success" : "text-warning")}>{met ? "Ready" : "Blocked"}</span>
                        <button className="opacity-0 group-hover:opacity-100" onClick={() => removeDependency(d.id)} aria-label="Remove"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
            <Card>
              <CardHeader title="External dependencies" subtitle="Requests you are waiting on" action={<Button size="sm" variant="secondary" onClick={() => openWaiting({ project_id: p.id })}><Plus />Add</Button>} />
              <div className="px-4 pb-4">
                {pwait.length === 0 ? <p className="text-xs text-muted-foreground">No external dependencies.</p> : pwait.sort((a, b) => Number(waitingActive(b)) - Number(waitingActive(a))).map((w) => {
                  const fs = followUpState(w);
                  return (
                    <div key={w.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                      <Hourglass className={cn("h-3.5 w-3.5", waitingActive(w) ? "text-warning" : "text-muted-foreground/50")} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => openWaiting(w)}>
                        <div className={cn("truncate text-[13px]", !waitingActive(w) && "text-muted-foreground line-through")}>{w.waiting_for}</div>
                        {w.title && <div className="truncate text-[11px] text-muted-foreground">{w.title}</div>}
                      </button>
                      {fs === "overdue" && <Badge tone="danger">Follow up</Badge>}
                      {waitingActive(w) && <Button size="sm" variant="ghost" onClick={() => { resolveWaiting(w.id); toast.success("Resolved — linked task is actionable again"); }}><Check />Resolve</Button>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Notes & links ---------------- */}
        <TabsContent value="notes"><NotesAndLinks projectId={p.id} /></TabsContent>

        {/* ---------------- Timeline ---------------- */}
        <TabsContent value="timeline"><Timeline projectId={p.id} /></TabsContent>

        {/* ---------------- History ---------------- */}
        <TabsContent value="history">
          <HistoryLog projectId={p.id} entries={activity_log.filter((a) => a.project_id === p.id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickAdd({ projectId, status = "next" }: { projectId: string; status?: "next" | "inbox" }) {
  const [v, setV] = React.useState("");
  return (
    <form className="flex items-center gap-2 px-2 py-1.5" onSubmit={(e) => {
      e.preventDefault();
      if (!v.trim()) return;
      createTask({ title: v.trim(), project_id: projectId, status });
      setV("");
    }}>
      <Plus className="h-4 w-4 text-muted-foreground" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add a task and press Enter" className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
    </form>
  );
}

function ProgressCard({ projectId }: { projectId: string }) {
  const { projects, tasks, milestones, settings } = useStore();
  const p = projects.find((x) => x.id === projectId)!;
  const prog = projectProgress(p, tasks, milestones, settings);
  const [draft, setDraft] = React.useState<number>(prog.value);
  React.useEffect(() => setDraft(prog.value), [prog.value]);
  return (
    <Card>
      <CardHeader title="Progress" subtitle={prog.source === "manual" ? "Your manual estimate" : prog.source === "work" ? "Estimated from tasks (40%) and milestones (60%)" : "Rough estimate from the research phase"} />
      <div className="px-4 pb-4">
        <div className="flex items-baseline gap-2"><span className="font-serif text-3xl tabular-nums">{prog.value}%</span><span className="text-xs text-muted-foreground">estimated</span></div>
        <ProgressBar value={prog.value} className="mt-2" muted={prog.source === "phase"} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/60 px-2.5 py-2"><div className="text-muted-foreground">Milestones reached</div><div className="mt-0.5 font-medium tabular-nums">{prog.milestonesDone} / {prog.milestonesTotal}</div></div>
          <div className="rounded-md bg-muted/60 px-2.5 py-2"><div className="text-muted-foreground">Tasks done</div><div className="mt-0.5 font-medium tabular-nums">{prog.tasksDone} / {prog.tasksTotal}</div></div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Override estimate</span>
            {p.progress_override !== null && <button className="text-primary hover:underline" onClick={() => updateProject(p.id, { progress_override: null })}>Reset to automatic</button>}
          </div>
          <input type="range" min={0} max={100} step={5} value={draft} onChange={(e) => setDraft(Number(e.target.value))}
            onMouseUp={() => draft !== prog.value && updateProject(p.id, { progress_override: draft })}
            onTouchEnd={() => draft !== prog.value && updateProject(p.id, { progress_override: draft })}
            onKeyUp={() => draft !== prog.value && updateProject(p.id, { progress_override: draft })}
            className="w-full accent-[hsl(var(--primary))]" aria-label="Manual progress estimate" />
        </div>
      </div>
    </Card>
  );
}

function ProjectTasks({ projectId }: { projectId: string }) {
  const tasks = useStore((s) => s.tasks).filter((t) => t.project_id === projectId && !t.parent_id);
  const [showDone, setShowDone] = React.useState(false);
  const groups = TASK_STATUSES.filter((s) => showDone || (s.key !== "done" && s.key !== "cancelled"));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-[hsl(var(--primary))]" />Show done & cancelled</label>
        <Button size="sm" onClick={() => useDialogs.getState().openTask({ project_id: projectId })}><Plus />Task</Button>
      </div>
      <Card className="py-1">
        <QuickAdd projectId={projectId} />
        {groups.map((g) => {
          const list = tasks.filter((t) => t.status === g.key).sort(sortByImportance);
          if (!list.length) return null;
          return (
            <div key={g.key} className="border-t px-2 pb-1 pt-2">
              <div className="section-label px-2 pb-1">{g.label} · {list.length}</div>
              {list.map((t) => <TaskRow key={t.id} task={t} showProject={false} />)}
            </div>
          );
        })}
        {tasks.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted-foreground">No tasks yet — add the first concrete step above.</p>}
      </Card>
    </div>
  );
}

function NotesAndLinks({ projectId }: { projectId: string }) {
  const p = useStore((s) => s.projects.find((x) => x.id === projectId))!;
  const [notes, setNotes] = React.useState(p.notes ?? "");
  const [dirty, setDirty] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [url, setUrl] = React.useState("");
  React.useEffect(() => { if (!dirty) setNotes(p.notes ?? ""); }, [p.notes, dirty]);
  React.useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { updateProject(p.id, { notes: notes || null }, { log: false }); setDirty(false); }, 900);
    return () => clearTimeout(t);
  }, [notes, dirty, p.id]);

  function addLink(e: React.FormEvent) {
    e.preventDefault();
    let u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { new URL(u); } catch { toast.error("That doesn't look like a valid URL."); return; }
    updateProject(p.id, { links: [...p.links, { id: uid(), label: label.trim() || new URL(u).hostname, url: u }] }, { log: false });
    setLabel(""); setUrl("");
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Research notes" subtitle={dirty ? "Saving…" : "Saved automatically"} />
        <div className="px-4 pb-4">
          <Textarea value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} onBlur={() => { if (dirty) { updateProject(p.id, { notes: notes || null }, { log: false }); setDirty(false); } }}
            className="min-h-[360px] font-serif text-[15px] leading-7" placeholder="Context, decisions, theoretical notes, data caveats…" />
        </div>
      </Card>
      <Card>
        <CardHeader title="Links & resources" />
        <div className="px-4 pb-4">
          {p.links.length === 0 && <p className="mb-3 text-xs text-muted-foreground">Data portals, Overleaf, Zotero collections, shared drives…</p>}
          {p.links.map((l) => (
            <div key={l.id} className="group flex items-center gap-2 py-1.5">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[13px] hover:text-primary" title={l.url}>{l.label}</a>
              <button className="opacity-0 group-hover:opacity-100" aria-label="Remove link" onClick={() => updateProject(p.id, { links: p.links.filter((x) => x.id !== l.id) }, { log: false })}><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" /></button>
            </div>
          ))}
          <form onSubmit={addLink} className="mt-3 space-y-1.5 border-t pt-3">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="h-7 text-xs" />
            <div className="flex gap-1.5">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="h-7 text-xs" />
              <Button type="submit" size="icon-sm" variant="secondary" aria-label="Add link"><Plus /></Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
}

function Timeline({ projectId }: { projectId: string }) {
  const { projects, tasks, milestones, waiting_items } = useStore();
  const p = projects.find((x) => x.id === projectId)!;
  const today = todayStr();
  type Ev = { date: string; title: string; kind: string; done?: boolean; icon: React.ReactNode };
  const ev: Ev[] = [];
  if (p.start_date) ev.push({ date: p.start_date, title: "Project start", kind: "Project", icon: <CircleDot /> });
  if (p.target_date) ev.push({ date: p.target_date, title: "Target completion", kind: "Project", icon: <Flag /> });
  for (const m of milestones.filter((x) => x.project_id === projectId)) {
    if (m.due_date) ev.push({ date: m.due_date, title: m.title, kind: MILESTONE_KINDS.find((k) => k.key === m.kind)?.label ?? "Milestone", done: !!m.completed_on, icon: <Flag /> });
    if (m.completed_on && m.completed_on !== m.due_date) ev.push({ date: m.completed_on, title: `${m.title} — reached`, kind: "Milestone reached", done: true, icon: <Check /> });
  }
  for (const t of tasks.filter((x) => x.project_id === projectId && x.due_date)) ev.push({ date: t.due_date!, title: t.title, kind: "Task due", done: !isOpenTask(t), icon: <CalendarDays /> });
  for (const w of waiting_items.filter((x) => x.project_id === projectId)) {
    ev.push({ date: w.initiated_on, title: `Requested: ${w.waiting_for}`, kind: "Request", icon: <Hourglass /> });
    if (w.expected_on && waitingActive(w)) ev.push({ date: w.expected_on, title: `Expected: ${w.waiting_for}`, kind: "Expected response", icon: <Hourglass /> });
  }
  ev.sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!ev.length) return <EmptyState icon={<CalendarDays />} title="Nothing on the timeline yet">Add a start/target date, milestone deadlines or task due dates.</EmptyState>;
  const todayIdx = ev.findIndex((e) => e.date >= today);
  return (
    <Card className="px-6 py-5">
      <ol className="relative ml-2 border-l">
        {ev.map((e, i) => (
          <React.Fragment key={i}>
            {i === todayIdx && <li className="relative -ml-px mb-4 flex items-center gap-2 pl-5"><span className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" /><span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Today · {fmtDate(today)}</span></li>}
            <li className="relative mb-4 pl-5">
              <span className={cn("absolute -left-[9px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border bg-card [&_svg]:size-2.5", e.done ? "text-success" : e.date < today ? "text-muted-foreground" : "text-foreground")}>{e.icon}</span>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="w-24 shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtDate(e.date, "MMM d")}</span>
                <span className={cn("text-[13px]", e.done && "text-muted-foreground line-through")}>{e.title}</span>
                <span className="text-[11px] text-muted-foreground">{e.kind}</span>
              </div>
            </li>
          </React.Fragment>
        ))}
        {todayIdx === -1 && <li className="relative -ml-px flex items-center gap-2 pl-5"><span className="absolute -left-[5px] h-2.5 w-2.5 rounded-full bg-primary" /><span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Today</span></li>}
      </ol>
    </Card>
  );
}

function HistoryLog({ projectId, entries }: { projectId: string; entries: { id: string; message: string; created_at: string; kind: string }[] }) {
  const [v, setV] = React.useState("");
  const sorted = [...entries].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Progress history" subtitle="Phase and status changes, completed work and your own progress notes" />
        <div className="px-4 pb-4">
          {sorted.length === 0 && <p className="text-xs text-muted-foreground">No history yet.</p>}
          {sorted.map((a) => (
            <div key={a.id} className="flex gap-3 border-b py-2 last:border-0">
              <span className="w-28 shrink-0 text-[11px] tabular-nums text-muted-foreground">{fmtDate(a.created_at.slice(0, 10), "MMM d")} · {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span className={cn("text-[13px]", a.kind === "note" && "font-serif italic")}>{a.message}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Log a progress note" subtitle="Non-linear progress counts too" />
        <form className="px-4 pb-4" onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; logActivity(projectId, "note", v.trim()); setV(""); toast.success("Logged"); }}>
          <Textarea value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. Reframed the mechanism around institutional capacity after advisor meeting." />
          <Button type="submit" size="sm" className="mt-2"><NotebookPen />Add to history</Button>
        </form>
        <div className="px-4 pb-4 text-[11px] text-muted-foreground"><History className="mr-1 inline h-3 w-3" />Entries are stored with the project and sync across devices.</div>
      </Card>
    </div>
  );
}
