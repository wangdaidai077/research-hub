"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowUpRight, Lightbulb, MoreHorizontal, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Segmented } from "@/components/ui/misc";
import { Input, Select } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { confirmDialog } from "@/components/ui/confirm";
import { PageHeader, ProjectIcon } from "@/components/bits";
import { useDialogs } from "@/components/dialog-store";
import { deleteIdea, promoteIdea, updateIdea } from "@/lib/actions";
import { useStore } from "@/lib/store";
import type { Idea } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";

export default function IdeasPage() {
  const router = useRouter();
  const { ideas, projects } = useStore();
  const openIdea = useDialogs((s) => s.openIdea);
  const [status, setStatus] = React.useState<"open" | "promoted" | "archived" | "all">("open");
  const [tag, setTag] = React.useState("");
  const [feas, setFeas] = React.useState("");
  const [q, setQ] = React.useState("");
  const tags = Array.from(new Set(ideas.flatMap((i) => i.tags))).sort();
  const list = ideas.filter((i) =>
    (status === "all" || i.status === status) && (!tag || i.tags.includes(tag)) && (!feas || i.feasibility === feas) &&
    (!q || `${i.title} ${i.question ?? ""} ${i.description ?? ""} ${i.literature ?? ""} ${i.theory ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  ).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  async function promote(i: Idea) {
    if (!(await confirmDialog({ title: "Promote to a research project?", description: `“${i.title}” becomes a new project in the Backlog status, carrying over its question, notes, literature and data sources. The idea is kept and marked as promoted.`, confirmLabel: "Create project" }))) return;
    const p = promoteIdea(i.id);
    if (p) { toast.success("Project created from idea"); router.push(`/projects/${p.id}`); }
  }

  return (
    <>
      <PageHeader title="Idea backlog" subtitle="Park ideas here so they don't hijack today's work."
        actions={<Button onClick={() => openIdea()}><Plus />Capture idea</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={status} onChange={setStatus} options={[
          { value: "open", label: `Open · ${ideas.filter((i) => i.status === "open").length}` }, { value: "promoted", label: "Promoted" },
          { value: "archived", label: "Archived" }, { value: "all", label: "All" },
        ]} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ideas…" className="h-7 w-44 text-xs" />
        <Select value={tag} onChange={(e) => setTag(e.target.value)} className="h-7 w-auto text-xs" aria-label="Tag"><option value="">All areas</option>{tags.map((t) => <option key={t}>{t}</option>)}</Select>
        <Select value={feas} onChange={(e) => setFeas(e.target.value)} className="h-7 w-auto text-xs" aria-label="Feasibility"><option value="">Any feasibility</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>
      </div>
      {ideas.length === 0 ? (
        <EmptyState icon={<Lightbulb />} title="No ideas yet" action={<Button onClick={() => openIdea()}>Capture your first idea</Button>}>
          Press <kbd className="rounded border px-1 font-mono text-[10px]">I</kbd> anywhere to capture an idea in seconds.
        </EmptyState>
      ) : list.length === 0 ? <EmptyState title="No ideas match" /> : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((i) => {
            const linked = projects.find((p) => p.id === i.linked_project_id);
            return (
              <Card key={i.id} className={cn("group flex flex-col p-4 transition-colors hover:border-foreground/20", i.status !== "open" && "opacity-75")}>
                <div className="flex items-start gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => openIdea(i)}>
                    <h3 className="text-[14px] font-semibold leading-snug">{i.title}</h3>
                  </button>
                  <Menu>
                    <MenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="Idea actions"><MoreHorizontal /></Button></MenuTrigger>
                    <MenuContent>
                      <MenuItem onSelect={() => openIdea(i)}><Pencil />Edit / link to project</MenuItem>
                      {i.status === "open" && <MenuItem onSelect={() => promote(i)}><Rocket />Promote to project</MenuItem>}
                      {i.status === "archived"
                        ? <MenuItem onSelect={() => updateIdea(i.id, { status: "open" })}><ArchiveRestore />Restore</MenuItem>
                        : i.status === "open" && <MenuItem onSelect={() => { updateIdea(i.id, { status: "archived" }); toast.success("Idea archived"); }}><Archive />Archive</MenuItem>}
                      <MenuSeparator />
                      <MenuItem danger onSelect={async () => { if (await confirmDialog({ title: "Delete idea?", confirmLabel: "Delete", destructive: true })) deleteIdea(i.id); }}><Trash2 />Delete</MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
                {i.question && <p className="mt-1.5 font-serif text-[14px] italic leading-relaxed text-muted-foreground">{i.question}</p>}
                {i.description && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{i.description}</p>}
                <dl className="mt-3 space-y-1 text-[11.5px]">
                  {i.data_sources && <div className="line-clamp-1"><dt className="inline text-muted-foreground">Data: </dt><dd className="inline">{i.data_sources}</dd></div>}
                  {i.literature && <div className="line-clamp-1"><dt className="inline text-muted-foreground">Literature: </dt><dd className="inline">{i.literature}</dd></div>}
                  {i.theory && <div className="line-clamp-1"><dt className="inline text-muted-foreground">Theory: </dt><dd className="inline">{i.theory}</dd></div>}
                </dl>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                  {i.tags.map((t) => <Badge key={t} tone="outline">{t}</Badge>)}
                  <Badge tone={i.feasibility === "high" ? "success" : i.feasibility === "low" ? "danger" : "neutral"}>{i.feasibility} feasibility</Badge>
                  {i.status === "promoted" && <Badge tone="primary">Promoted</Badge>}
                  <span className="ml-auto text-[11px] text-muted-foreground">{fmtDate(i.created_at.slice(0, 10))}</span>
                </div>
                {linked && (
                  <Link href={`/projects/${linked.id}`} className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5 text-[12px] text-muted-foreground hover:text-foreground">
                    <ProjectIcon project={linked} size={14} />{i.status === "promoted" ? "Became" : "Linked to"} {linked.title}<ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
                {i.status === "open" && (
                  <Button size="sm" variant="ghost" className="mt-2 self-start opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" onClick={() => promote(i)}><Rocket />Promote</Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
