"use client";
import * as React from "react";
import { Hourglass, Link2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { confirmDialog } from "@/components/ui/confirm";
import { useDialogs } from "@/components/dialog-store";
import { TaskStatusBadge } from "@/components/bits";
import { addDependency, createTask, deleteTask, removeDependency, toggleTaskDone, updateTask } from "@/lib/actions";
import { COGNITIVE_LOADS, PRIORITIES, RECURRENCES, TASK_STATUSES } from "@/lib/constants";
import { newTask } from "@/lib/factories";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export function TaskDialogHost() {
  const state = useDialogs((s) => s.task);
  const close = useDialogs((s) => s.close);
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close("task")}>
      {state && <TaskForm key={state.initial.id ?? "new"} initial={state.initial} editing={state.editing} onDone={() => close("task")} />}
    </Dialog>
  );
}

function TaskForm({ initial, editing, onDone }: { initial: Partial<Task>; editing: boolean; onDone: () => void }) {
  const projects = useStore((s) => s.projects);
  const milestones = useStore((s) => s.milestones);
  const tasks = useStore((s) => s.tasks);
  const deps = useStore((s) => s.task_dependencies);
  const waiting = useStore((s) => s.waiting_items);
  const live = editing ? tasks.find((t) => t.id === initial.id) : undefined;
  const [f, setF] = React.useState<Task>(() => (live ? { ...live } : newTask({ status: "next", title: "", ...initial })));
  const [err, setErr] = React.useState<string | null>(null);
  const [sub, setSub] = React.useState("");
  const [depPick, setDepPick] = React.useState("");
  const openWaiting = useDialogs((s) => s.openWaiting);

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setF((x) => ({ ...x, [k]: v }));
  const projMilestones = milestones.filter((m) => m.project_id === f.project_id);
  const subtasks = tasks.filter((t) => t.parent_id === f.id).sort((a, b) => a.sort_order - b.sort_order);
  const myDeps = deps.filter((d) => d.task_id === f.id);
  const depCandidates = tasks
    .filter((t) => t.id !== f.id && t.parent_id !== f.id && !myDeps.some((d) => d.depends_on_id === t.id) && t.status !== "cancelled")
    .sort((a, b) => (a.project_id === f.project_id ? -1 : 1) - (b.project_id === f.project_id ? -1 : 1));
  const openWaits = waiting.filter((w) => w.task_id === f.id && (w.status === "waiting" || w.status === "followed_up"));
  const parent = f.parent_id ? tasks.find((t) => t.id === f.parent_id) : null;

  function save() {
    if (!f.title.trim()) { setErr("Give the task a title."); return; }
    const clean = { ...f, title: f.title.trim() };
    if (editing) {
      const { id, ...patch } = clean;
      updateTask(id, patch);
      toast.success("Task saved");
    } else {
      createTask(clean);
      toast.success("Task created");
    }
    onDone();
  }

  function ensureSaved(): boolean {
    if (editing) return true;
    if (!f.title.trim()) { setErr("Give the task a title first."); return false; }
    return true;
  }

  function addSub() {
    if (!sub.trim()) return;
    if (!editing) { toast.message("Save the task first, then add subtasks."); return; }
    createTask({ title: sub.trim(), parent_id: f.id, project_id: f.project_id, status: "next", cognitive_load: f.cognitive_load, sort_order: Date.now() });
    setSub("");
  }

  function addDep() {
    if (!depPick || !ensureSaved()) return;
    if (!editing) { toast.message("Save the task first, then add dependencies."); return; }
    const e = addDependency(f.id, depPick);
    if (e) toast.error(e); else setDepPick("");
  }

  async function onDelete() {
    if (await confirmDialog({ title: "Delete task?", description: "The task, its subtasks and its dependency links will be permanently deleted.", confirmLabel: "Delete", destructive: true })) {
      deleteTask(f.id); toast.success("Task deleted"); onDone();
    }
  }

  return (
    <DialogContent
      wide
      title={editing ? "Edit task" : "New task"}
      description={parent ? `Subtask of “${parent.title}”` : editing && live ? `Created ${timeAgo(live.created_at)}${live.completed_at ? ` · completed ${timeAgo(live.completed_at)}` : ""}` : undefined}
      footer={
        <>
          {editing && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 />Delete</Button>}
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <Button onClick={save}>{editing ? "Save changes" : "Create task"}</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid grid-cols-1 gap-4">
        <Field label="Title" error={err}>
          <Input data-autofocus value={f.title} onChange={(e) => { set("title", e.target.value); setErr(null); }} placeholder="e.g. Draft theory section" />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Project">
            <Select value={f.project_id ?? ""} onChange={(e) => { set("project_id", e.target.value || null); set("milestone_id", null); }}>
              <option value="">No project</option>
              {projects.filter((p) => p.status !== "archived" || p.id === f.project_id).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as Task["status"])}>
              {TASK_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onChange={(e) => set("priority", e.target.value as Task["priority"])}>
              {PRIORITIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Cognitive load">
            <Select value={f.cognitive_load} onChange={(e) => set("cognitive_load", e.target.value as Task["cognitive_load"])}>
              {COGNITIVE_LOADS.map((s) => <option key={s.key} value={s.key} title={s.hint}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
          </Field>
          <Field label="Scheduled work date">
            <Input type="date" value={f.scheduled_date ?? ""} onChange={(e) => set("scheduled_date", e.target.value || null)} />
          </Field>
          <Field label="Estimated effort (h)">
            <Input type="number" min={0} step={0.25} value={f.effort_hours ?? ""} onChange={(e) => set("effort_hours", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label="Actual time (h)">
            <Input type="number" min={0} step={0.25} value={f.actual_hours ?? ""} onChange={(e) => set("actual_hours", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label="Milestone">
            <Select value={f.milestone_id ?? ""} onChange={(e) => set("milestone_id", e.target.value || null)} disabled={!f.project_id}>
              <option value="">None</option>
              {projMilestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </Select>
          </Field>
          <Field label="Repeats">
            <Select value={f.recurrence} onChange={(e) => set("recurrence", e.target.value as Task["recurrence"])}>
              {RECURRENCES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={f.description ?? ""} onChange={(e) => set("description", e.target.value || null)} placeholder="What does done look like?" />
        </Field>
        <Field label="Notes">
          <Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} className="min-h-[56px]" />
        </Field>
        <button type="submit" className="hidden" />
      </form>

      {editing && (
        <div className="mt-6 grid gap-6 border-t pt-5 sm:grid-cols-2">
          <section>
            <div className="section-label mb-2">Subtasks</div>
            <div className="space-y-1">
              {subtasks.map((s) => (
                <div key={s.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-accent/50">
                  <Checkbox checked={s.status === "done"} onChange={() => toggleTaskDone(s)} />
                  <span className={s.status === "done" ? "flex-1 text-[13px] text-muted-foreground line-through" : "flex-1 text-[13px]"}>{s.title}</span>
                  <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(s.id)} aria-label="Delete subtask"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <div className="flex gap-1.5 pt-1">
                <Input value={sub} onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub())} placeholder="Add a subtask…" className="h-7" />
                <Button size="icon-sm" variant="secondary" onClick={addSub} aria-label="Add subtask"><Plus /></Button>
              </div>
            </div>
          </section>
          <section>
            <div className="section-label mb-2">Depends on</div>
            <div className="space-y-1">
              {myDeps.length === 0 && <p className="text-xs text-muted-foreground">No dependencies.</p>}
              {myDeps.map((d) => {
                const t = tasks.find((x) => x.id === d.depends_on_id);
                if (!t) return null;
                return (
                  <div key={d.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-accent/50">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate text-[13px]">{t.title}</span>
                    <TaskStatusBadge s={t.status} />
                    <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => removeDependency(d.id)} aria-label="Remove dependency"><X className="h-3.5 w-3.5" /></button>
                  </div>
                );
              })}
              <div className="flex gap-1.5 pt-1">
                <Select value={depPick} onChange={(e) => setDepPick(e.target.value)} className="h-7 text-xs">
                  <option value="">Choose a task…</option>
                  {depCandidates.map((t) => {
                    const p = projects.find((x) => x.id === t.project_id);
                    return <option key={t.id} value={t.id}>{t.title}{p && p.id !== f.project_id ? ` — ${p.title}` : ""}</option>;
                  })}
                </Select>
                <Button size="icon-sm" variant="secondary" onClick={addDep} aria-label="Add dependency"><Plus /></Button>
              </div>
            </div>
            <div className="section-label mb-2 mt-5">External waiting</div>
            {openWaits.map((w) => (
              <p key={w.id} className="mb-1 flex items-center gap-1.5 text-xs text-warning"><Hourglass className="h-3 w-3" />Waiting on {w.waiting_for}</p>
            ))}
            <Button size="sm" variant="secondary" onClick={() => { onDone(); openWaiting({ task_id: f.id, project_id: f.project_id, title: f.title }); }}>
              <Hourglass />Waiting on someone…
            </Button>
          </section>
        </div>
      )}
    </DialogContent>
  );
}
