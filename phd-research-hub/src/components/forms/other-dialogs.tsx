"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { confirmDialog } from "@/components/ui/confirm";
import { useDialogs } from "@/components/dialog-store";
import {
  createIdea, createMilestone, createWaiting, deleteIdea, deleteMilestone, deleteWaiting, updateIdea, updateMilestone, updateWaiting,
} from "@/lib/actions";
import { MILESTONE_KINDS, WAITING_STATUSES } from "@/lib/constants";
import { newIdea, newMilestone, newWaiting } from "@/lib/factories";
import { useStore } from "@/lib/store";
import type { Idea, Milestone, WaitingItem } from "@/lib/types";
import { toDateStr } from "@/lib/utils";

// ---------------- Waiting item ----------------
export function WaitingDialogHost() {
  const state = useDialogs((s) => s.waiting);
  const close = useDialogs((s) => s.close);
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close("waiting")}>
      {state && <WaitingForm key={state.initial.id ?? "new"} initial={state.initial} editing={state.editing} onDone={() => close("waiting")} />}
    </Dialog>
  );
}

function WaitingForm({ initial, editing, onDone }: { initial: Partial<WaitingItem>; editing: boolean; onDone: () => void }) {
  const projects = useStore((s) => s.projects);
  const tasks = useStore((s) => s.tasks);
  const items = useStore((s) => s.waiting_items);
  const live = editing ? items.find((w) => w.id === initial.id) : undefined;
  const [f, setF] = React.useState<WaitingItem>(() => live ? { ...live } : newWaiting({
    waiting_for: "", follow_up_on: toDateStr(addDays(new Date(), 7)), ...initial,
  }));
  const [err, setErr] = React.useState<string | null>(null);
  const set = <K extends keyof WaitingItem>(k: K, v: WaitingItem[K]) => setF((x) => ({ ...x, [k]: v }));
  const projTasks = tasks.filter((t) => !f.project_id || t.project_id === f.project_id).filter((t) => t.status !== "done" && t.status !== "cancelled" || t.id === f.task_id);

  function save() {
    if (!f.waiting_for.trim()) { setErr("Who or what are you waiting for?"); return; }
    if (f.follow_up_on && f.follow_up_on < f.initiated_on) { setErr("Follow-up date is before the request date."); return; }
    if (editing) { const { id, ...patch } = f; updateWaiting(id, patch); toast.success("Saved"); }
    else { createWaiting(f); toast.success("Added to waiting tracker", { description: f.task_id ? "The linked task was moved to Waiting." : undefined }); }
    onDone();
  }
  async function onDelete() {
    if (await confirmDialog({ title: "Delete waiting item?", confirmLabel: "Delete", destructive: true })) { deleteWaiting(f.id); onDone(); }
  }

  return (
    <DialogContent
      title={editing ? "Edit waiting item" : "Track an external dependency"}
      description="Waiting is not the same as being late — these items never count as overdue work."
      footer={<>
        {editing && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 />Delete</Button>}
        <Button variant="secondary" onClick={onDone}>Cancel</Button><Button onClick={save}>{editing ? "Save" : "Add"}</Button>
      </>}
    >
      <form className="grid grid-cols-1 gap-3.5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Waiting for (whom or what)" error={err}>
          <Input data-autofocus value={f.waiting_for} onChange={(e) => { set("waiting_for", e.target.value); setErr(null); }} placeholder="e.g. Advisor feedback, IRB approval, City records office" />
        </Field>
        <Field label="What was requested">
          <Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value || null)} placeholder="e.g. Comments on chapter 2 draft" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project">
            <Select value={f.project_id ?? ""} onChange={(e) => { set("project_id", e.target.value || null); set("task_id", null); }}>
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
          <Field label="Related task">
            <Select value={f.task_id ?? ""} onChange={(e) => set("task_id", e.target.value || null)}>
              <option value="">None</option>
              {projTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
          </Field>
          <Field label="Requested on"><Input type="date" value={f.initiated_on} onChange={(e) => set("initiated_on", e.target.value || toDateStr(new Date()))} /></Field>
          <Field label="Expected response (optional)"><Input type="date" value={f.expected_on ?? ""} onChange={(e) => set("expected_on", e.target.value || null)} /></Field>
          <Field label="Next follow-up"><Input type="date" value={f.follow_up_on ?? ""} onChange={(e) => set("follow_up_on", e.target.value || null)} /></Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set("status", e.target.value as WaitingItem["status"])}>
              {WAITING_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Reference / tracking number"><Input value={f.reference ?? ""} onChange={(e) => set("reference", e.target.value || null)} placeholder="e.g. PIA request #, manuscript ID" /></Field>
        <Field label="Notes"><Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </DialogContent>
  );
}

// ---------------- Milestone ----------------
export function MilestoneDialogHost() {
  const state = useDialogs((s) => s.milestone);
  const close = useDialogs((s) => s.close);
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close("milestone")}>
      {state && <MilestoneForm key={state.initial.id ?? "new"} initial={state.initial} editing={state.editing} onDone={() => close("milestone")} />}
    </Dialog>
  );
}

function MilestoneForm({ initial, editing, onDone }: { initial: Partial<Milestone>; editing: boolean; onDone: () => void }) {
  const ms = useStore((s) => s.milestones);
  const projects = useStore((s) => s.projects);
  const live = editing ? ms.find((m) => m.id === initial.id) : undefined;
  const [f, setF] = React.useState<Milestone>(() => live ? { ...live } : newMilestone({ title: "", project_id: initial.project_id ?? projects[0]?.id ?? "", ...initial }));
  const [err, setErr] = React.useState<string | null>(null);
  const set = <K extends keyof Milestone>(k: K, v: Milestone[K]) => setF((x) => ({ ...x, [k]: v }));
  const journalish = f.kind === "submission" || f.kind === "decision" || f.kind === "revision" || f.kind === "conference";

  function save() {
    if (!f.title.trim()) { setErr("Give the milestone a title."); return; }
    if (!f.project_id) { setErr("Choose a project."); return; }
    if (editing) { const { id, ...patch } = f; updateMilestone(id, patch); }
    else createMilestone(f);
    toast.success("Milestone saved");
    onDone();
  }
  async function onDelete() {
    if (await confirmDialog({ title: "Delete milestone?", description: "Tasks linked to it are kept but unlinked.", confirmLabel: "Delete", destructive: true })) { deleteMilestone(f.id); onDone(); }
  }

  return (
    <DialogContent
      title={editing ? "Edit milestone" : "New milestone"}
      footer={<>
        {editing && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 />Delete</Button>}
        <Button variant="secondary" onClick={onDone}>Cancel</Button><Button onClick={save}>Save</Button>
      </>}
    >
      <form className="grid grid-cols-1 gap-3.5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Title" error={err}><Input data-autofocus value={f.title} onChange={(e) => { set("title", e.target.value); setErr(null); }} placeholder="e.g. Complete IRB application" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={f.kind} onChange={(e) => set("kind", e.target.value as Milestone["kind"])}>
              {MILESTONE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={f.project_id} onChange={(e) => set("project_id", e.target.value)} disabled={editing}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
          <Field label={f.kind === "submission" ? "Submission date / target" : f.kind === "revision" ? "Revision deadline" : "Deadline"}>
            <Input type="date" value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
          </Field>
          <Field label="Completed on">
            <Input type="date" value={f.completed_on ?? ""} onChange={(e) => set("completed_on", e.target.value || null)} />
          </Field>
          {journalish && <Field label="Journal / venue"><Input value={f.venue ?? ""} onChange={(e) => set("venue", e.target.value || null)} /></Field>}
          {(f.kind === "decision" || f.kind === "submission" || f.kind === "revision") && (
            <Field label="Decision">
              <Select value={f.decision ?? ""} onChange={(e) => set("decision", e.target.value || null)}>
                <option value="">—</option>
                <option>Desk reject</option><option>Reject</option><option>Major revision</option><option>Minor revision</option><option>Accept</option><option>Withdrawn</option>
              </Select>
            </Field>
          )}
        </div>
        <Field label="Notes"><Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </DialogContent>
  );
}

// ---------------- Idea ----------------
export function IdeaDialogHost() {
  const state = useDialogs((s) => s.idea);
  const close = useDialogs((s) => s.close);
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close("idea")}>
      {state && <IdeaForm key={state.initial.id ?? "new"} initial={state.initial} editing={state.editing} onDone={() => close("idea")} />}
    </Dialog>
  );
}

function IdeaForm({ initial, editing, onDone }: { initial: Partial<Idea>; editing: boolean; onDone: () => void }) {
  const ideas = useStore((s) => s.ideas);
  const projects = useStore((s) => s.projects);
  const live = editing ? ideas.find((i) => i.id === initial.id) : undefined;
  const [f, setF] = React.useState<Idea>(() => live ? { ...live } : newIdea({ title: "", ...initial }));
  const [tags, setTags] = React.useState(f.tags.join(", "));
  const [err, setErr] = React.useState<string | null>(null);
  const [more, setMore] = React.useState(editing);
  const set = <K extends keyof Idea>(k: K, v: Idea[K]) => setF((x) => ({ ...x, [k]: v }));

  function save() {
    if (!f.title.trim()) { setErr("Give the idea a short title."); return; }
    const row = { ...f, title: f.title.trim(), tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
    if (editing) { const { id, ...patch } = row; updateIdea(id, patch); toast.success("Idea saved"); }
    else { createIdea(row); toast.success("Idea captured", { description: "It's parked in your backlog — back to work." }); }
    onDone();
  }
  async function onDelete() {
    if (await confirmDialog({ title: "Delete idea?", confirmLabel: "Delete", destructive: true })) { deleteIdea(f.id); onDone(); }
  }

  return (
    <DialogContent
      title={editing ? "Edit idea" : "Capture an idea"}
      description={editing ? undefined : "Write it down, then get back to what you were doing."}
      footer={<>
        {editing && <Button variant="ghost" className="mr-auto text-destructive" onClick={onDelete}><Trash2 />Delete</Button>}
        <Button variant="secondary" onClick={onDone}>Cancel</Button><Button onClick={save}>{editing ? "Save" : "Save idea"}</Button>
      </>}
    >
      <form className="grid grid-cols-1 gap-3.5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Idea" error={err}><Input data-autofocus value={f.title} onChange={(e) => { set("title", e.target.value); setErr(null); }} placeholder="A short handle for the idea" /></Field>
        <Field label="Initial research question"><Textarea className="min-h-[52px]" value={f.question ?? ""} onChange={(e) => set("question", e.target.value || null)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tags / research area" hint="Comma-separated"><Input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
          <Field label="Feasibility">
            <Select value={f.feasibility} onChange={(e) => set("feasibility", e.target.value as Idea["feasibility"])}>
              <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </Select>
          </Field>
        </div>
        {!more ? (
          <button type="button" className="justify-self-start text-xs text-primary hover:underline" onClick={() => setMore(true)}>Add literature, data sources, theory…</button>
        ) : (
          <>
            <Field label="Short description"><Textarea className="min-h-[52px]" value={f.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></Field>
            <Field label="Related literature"><Textarea className="min-h-[52px]" value={f.literature ?? ""} onChange={(e) => set("literature", e.target.value || null)} /></Field>
            <Field label="Potential data sources"><Textarea className="min-h-[52px]" value={f.data_sources ?? ""} onChange={(e) => set("data_sources", e.target.value || null)} /></Field>
            <Field label="Theoretical relevance"><Textarea className="min-h-[52px]" value={f.theory ?? ""} onChange={(e) => set("theory", e.target.value || null)} /></Field>
            <Field label="Link to existing project">
              <Select value={f.linked_project_id ?? ""} onChange={(e) => set("linked_project_id", e.target.value || null)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </Field>
            <Field label="Notes"><Textarea className="min-h-[52px]" value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></Field>
          </>
        )}
        <button type="submit" className="hidden" />
      </form>
    </DialogContent>
  );
}
