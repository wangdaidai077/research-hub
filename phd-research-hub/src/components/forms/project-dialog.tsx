"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { useDialogs } from "@/components/dialog-store";
import { EmojiPicker, ImageField } from "@/components/image-field";
import { ProjectCover, ProjectIcon } from "@/components/bits";
import { createProject, updateProject } from "@/lib/actions";
import { PRIORITIES } from "@/lib/constants";
import { newProject } from "@/lib/factories";
import { phasesOf, statusesOf } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { deleteImage } from "@/lib/images";
import type { Project } from "@/lib/types";

export function ProjectDialogHost() {
  const state = useDialogs((s) => s.project);
  const close = useDialogs((s) => s.close);
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close("project")}>
      {state && <ProjectForm key={state.initial.id ?? "new"} initial={state.initial} editing={state.editing} initialTab={state.tab} onDone={() => close("project")} />}
    </Dialog>
  );
}

function ProjectForm({ initial, editing, onDone, initialTab }: { initial: Partial<Project>; editing: boolean; onDone: () => void; initialTab?: "details" | "appearance" }) {
  const router = useRouter();
  const settings = useStore((s) => s.settings);
  const projects = useStore((s) => s.projects);
  const live = editing ? projects.find((p) => p.id === initial.id) : undefined;
  const [f, setF] = React.useState<Project>(() => live ? { ...live } : newProject({ title: "", status: "active", phase: phasesOf(settings)[0]?.key, ...initial }));
  const [tab, setTab] = React.useState<"details" | "appearance">(initialTab ?? "details");
  const [err, setErr] = React.useState<string | null>(null);
  const [iconMode, setIconMode] = React.useState<"emoji" | "image">(f.icon_path ? "image" : "emoji");
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setF((x) => ({ ...x, [k]: v }));
  const categories = Array.from(new Set(projects.map((p) => p.category).filter(Boolean))) as string[];

  // Image changes on an existing project persist immediately so the stored file
  // and the database never disagree, even if the dialog is cancelled.
  const setImage = (k: "cover_path" | "icon_path", v: string | null) => {
    set(k, v);
    if (editing) updateProject(f.id, { [k]: v }, { log: false });
  };

  function save() {
    if (!f.title.trim()) { setErr("A project needs a title."); setTab("details"); return; }
    if (f.start_date && f.target_date && f.target_date < f.start_date) { setErr("Target completion is before the start date."); setTab("details"); return; }
    const clean = { ...f, title: f.title.trim() };
    if (iconMode === "emoji" && clean.icon_path) { deleteImage(clean.icon_path); clean.icon_path = null; }
    if (iconMode === "image" && clean.icon_path) clean.icon_emoji = null;
    if (editing) {
      const { id, ...patch } = clean;
      updateProject(id, patch);
      toast.success("Project saved");
      onDone();
    } else {
      const p = createProject(clean);
      toast.success("Project created");
      onDone();
      router.push(`/projects/${p.id}`);
    }
  }

  return (
    <DialogContent
      wide
      title={editing ? "Edit project" : "New research project"}
      footer={<><Button variant="secondary" onClick={onDone}>Cancel</Button><Button onClick={save}>{editing ? "Save changes" : "Create project"}</Button></>}
    >
      <Segmented className="mb-4" value={tab} onChange={setTab} options={[{ value: "details", label: "Details" }, { value: "appearance", label: "Cover & icon" }]} />
      {tab === "details" ? (
        <form className="grid grid-cols-1 gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Field label="Project title" error={err}>
            <Input data-autofocus value={f.title} onChange={(e) => { set("title", e.target.value); setErr(null); }} placeholder="e.g. Housing recovery after Hurricane Harvey" />
          </Field>
          <Field label="Research question">
            <Textarea className="min-h-[56px]" value={f.research_question ?? ""} onChange={(e) => set("research_question", e.target.value || null)} placeholder="What do you want to find out?" />
          </Field>
          <Field label="Description">
            <Textarea className="min-h-[56px]" value={f.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Research area / category">
              <Input list="cat-list" value={f.category ?? ""} onChange={(e) => set("category", e.target.value || null)} placeholder="e.g. Disaster Recovery" />
              <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Research phase">
              <Select value={f.phase} onChange={(e) => set("phase", e.target.value)}>
                {phasesOf(settings).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Activity status" hint="Independent of phase">
              <Select value={f.status} onChange={(e) => set("status", e.target.value)}>
                {statusesOf(settings).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={f.priority} onChange={(e) => set("priority", e.target.value as Project["priority"])}>
                {PRIORITIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Start date"><Input type="date" value={f.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></Field>
            <Field label="Target completion"><Input type="date" value={f.target_date ?? ""} onChange={(e) => set("target_date", e.target.value || null)} /></Field>
          </div>
          <Field label="Collaborators / advisors">
            <Input value={f.collaborators ?? ""} onChange={(e) => set("collaborators", e.target.value || null)} placeholder="Comma-separated names" />
          </Field>
          <Field label="Notes">
            <Textarea value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
          </Field>
          <button type="submit" className="hidden" />
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div>
            <ImageField kind="cover" label="Cover image" path={f.cover_path} onChange={(v) => setImage("cover_path", v)} position={f.cover_position} />
            {f.cover_path && (
              <Field label={`Vertical position · ${f.cover_position}%`} className="mt-3 max-w-sm">
                <input type="range" min={0} max={100} value={f.cover_position} className="accent-[hsl(var(--primary))]"
                  onChange={(e) => set("cover_position", Number(e.target.value))}
                  onMouseUp={() => editing && updateProject(f.id, { cover_position: f.cover_position }, { log: false })}
                  onTouchEnd={() => editing && updateProject(f.id, { cover_position: f.cover_position }, { log: false })} />
              </Field>
            )}
            {!f.cover_path && <p className="mt-1 text-[11px] text-muted-foreground">Without an image, a quiet pattern in your accent colour is used.</p>}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Project icon</span>
              <Segmented value={iconMode} onChange={setIconMode} options={[{ value: "emoji", label: "Emoji" }, { value: "image", label: "Image" }]} />
            </div>
            {iconMode === "emoji"
              ? <EmojiPicker value={f.icon_emoji} onChange={(v) => { set("icon_emoji", v); }} />
              : <ImageField kind="icon" path={f.icon_path} onChange={(v) => setImage("icon_path", v)} aspect="aspect-square max-w-[120px]" />}
          </div>
          <div>
            <div className="section-label mb-2">Preview</div>
            <div className="max-w-xs overflow-hidden rounded-lg border bg-card">
              <ProjectCover project={f} className="h-20" />
              <div className="flex items-center gap-2 p-3">
                <ProjectIcon project={{ ...f, icon_path: iconMode === "image" ? f.icon_path : null, title: f.title || "Project" }} size={20} />
                <span className="truncate text-[13px] font-medium">{f.title || "Project title"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
