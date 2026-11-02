"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowDownUp, Download, FolderPlus, Kanban as KanbanIcon, LayoutGrid, MoreHorizontal, Pencil, Rows3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, ProgressBar, Segmented } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { confirmDialog } from "@/components/ui/confirm";
import { DueLabel, PageHeader, PriorityBadge, ProjectIcon } from "@/components/bits";
import { ProjectCard } from "@/components/project-card";
import { Kanban } from "@/components/kanban";
import { ProjectActions } from "@/components/project-actions";
import { useDialogs } from "@/components/dialog-store";
import { deleteProject, updateProject } from "@/lib/actions";
import { PRIORITY_RANK } from "@/lib/constants";
import { exportProjectsCSV } from "@/lib/backup";
import { nextActionable, phaseLabel, phasesOf, projectNextDeadline, projectProgress, statusKind, statusesOf } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Project } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

type SortKey = "title" | "category" | "phase" | "status" | "priority" | "deadline" | "progress" | "activity";

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, tasks, milestones, task_dependencies, settings } = useStore();
  const openProject = useDialogs((s) => s.openProject);
  const [view, setView] = React.useState<"table" | "board" | "cards">("table");
  const [showArchived, setShowArchived] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [area, setArea] = React.useState("");
  const [sort, setSort] = React.useState<{ k: SortKey; dir: 1 | -1 }>({ k: "priority", dir: -1 });

  React.useEffect(() => {
    try { const v = localStorage.getItem("hub:projects-view"); if (v === "table" || v === "board" || v === "cards") setView(v); } catch { /* */ }
  }, []);
  const changeView = (v: typeof view) => { setView(v); try { localStorage.setItem("hub:projects-view", v); } catch { /* */ } };

  const phases = phasesOf(settings);
  const statuses = statusesOf(settings);
  const areas = Array.from(new Set(projects.map((p) => p.category).filter(Boolean))) as string[];

  const filtered = projects.filter((p) => {
    if (!showArchived && statusKind(settings, p.status) === "archived") return false;
    if (area && p.category !== area) return false;
    if (q && !`${p.title} ${p.research_question ?? ""} ${p.description ?? ""} ${p.collaborators ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const val = (p: Project): string | number => {
    switch (sort.k) {
      case "title": return p.title.toLowerCase();
      case "category": return (p.category ?? "~").toLowerCase();
      case "phase": return phases.findIndex((x) => x.key === p.phase);
      case "status": return statuses.findIndex((x) => x.key === p.status);
      case "priority": return PRIORITY_RANK[p.priority];
      case "deadline": return projectNextDeadline(p, milestones)?.date ?? "9999";
      case "progress": return projectProgress(p, tasks, milestones, settings).value;
      case "activity": return p.last_activity_at;
    }
  };
  const sorted = [...filtered].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2 text-left font-medium", className)}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : k === "priority" || k === "progress" || k === "activity" ? -1 : 1 }))}>
        {children}{sort.k === k && <ArrowDownUp className="h-3 w-3" />}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Research projects"
        subtitle={`${filtered.length} project${filtered.length === 1 ? "" : "s"}${showArchived ? " incl. archived" : ""}`}
        actions={<>
          <Button variant="secondary" onClick={() => exportProjectsCSV()}><Download />CSV</Button>
          <Button onClick={() => openProject()}><FolderPlus />New project</Button>
        </>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={changeView} options={[
          { value: "table", label: <><Rows3 />Table</> }, { value: "board", label: <><KanbanIcon />Status board</> }, { value: "cards", label: <><LayoutGrid />Cards</> },
        ]} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" className="h-7 w-48 text-xs" />
        <Select value={area} onChange={(e) => setArea(e.target.value)} className="h-7 w-auto text-xs">
          <option value="">All research areas</option>
          {areas.map((a) => <option key={a}>{a}</option>)}
        </Select>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[hsl(var(--primary))]" />Show archived
        </label>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={<FolderPlus />} title="No projects yet" action={<Button onClick={() => openProject()}>Create your first project</Button>}>
          Projects hold your research question, phase, milestones, tasks and notes.
        </EmptyState>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{sorted.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
      ) : view === "board" ? (
        <Kanban
          columns={statuses.filter((s) => showArchived || s.kind !== "archived").map((s) => ({ key: s.key, label: s.label }))}
          items={sorted}
          columnOf={(p) => p.status}
          onMove={(p, col) => { updateProject(p.id, { status: col }); toast.success(`Moved to ${statuses.find((s) => s.key === col)?.label}`); }}
          renderItem={(p) => {
            const prog = projectProgress(p, tasks, milestones, settings);
            return (
              <Link href={`/projects/${p.id}`} draggable={false} className="surface block rounded-md border bg-card p-3 shadow-sm hover:border-foreground/20">
                <div className="flex items-center gap-2"><ProjectIcon project={p} size={16} /><span className="truncate text-[13px] font-medium">{p.title}</span></div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">{phaseLabel(settings, p.phase)}</div>
                <ProgressBar value={prog.value} className="mt-2" muted={prog.source === "phase"} />
              </Link>
            );
          }}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead className="border-b text-[11px] text-muted-foreground">
              <tr>
                <Th k="title" className="pl-4">Project</Th><Th k="category">Area</Th><Th k="phase">Phase</Th><Th k="status">Status</Th>
                <Th k="priority">Priority</Th><th className="px-3 py-2 text-left font-medium">Next action</th><Th k="deadline">Deadline</Th>
                <Th k="progress">Progress</Th><Th k="activity">Activity</Th><th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const prog = projectProgress(p, tasks, milestones, settings);
                const next = nextActionable(p.id, tasks, task_dependencies);
                const dl = projectNextDeadline(p, milestones);
                const archived = statusKind(settings, p.status) === "archived";
                return (
                  <tr key={p.id} className={cn("border-b last:border-0 hover:bg-accent/40", archived && "opacity-60")}>
                    <td className="py-2 pl-4 pr-3">
                      <Link href={`/projects/${p.id}`} className="flex items-center gap-2 font-medium hover:text-primary"><ProjectIcon project={p} size={18} /><span className="truncate max-w-[260px]">{p.title}</span></Link>
                    </td>
                    <td className="px-3 text-muted-foreground">{p.category ?? "—"}</td>
                    <td className="px-3">
                      <Select value={p.phase} onChange={(e) => updateProject(p.id, { phase: e.target.value })} className="h-7 w-[150px] border-transparent bg-transparent text-xs shadow-none hover:border-input" aria-label="Phase">
                        {phases.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </Select>
                    </td>
                    <td className="px-3">
                      <Select value={p.status} onChange={(e) => updateProject(p.id, { status: e.target.value })} className="h-7 w-[120px] border-transparent bg-transparent text-xs shadow-none hover:border-input" aria-label="Status">
                        {statuses.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </Select>
                    </td>
                    <td className="px-3"><PriorityBadge p={p.priority} /></td>
                    <td className="max-w-[220px] truncate px-3 text-xs text-muted-foreground">{next?.title ?? "—"}</td>
                    <td className="px-3">{dl ? <DueLabel date={dl.date} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="w-[120px] px-3">
                      <div className="flex items-center gap-2"><ProgressBar value={prog.value} muted={prog.source === "phase"} className="w-16" /><span className="text-[11px] tabular-nums text-muted-foreground">{prog.value}%</span></div>
                    </td>
                    <td className="whitespace-nowrap px-3 text-[11px] text-muted-foreground">{timeAgo(p.last_activity_at)}</td>
                    <td className="pr-2"><ProjectActions project={p} onOpen={() => router.push(`/projects/${p.id}`)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No projects match.</p>}
        </Card>
      )}
    </>
  );
}

