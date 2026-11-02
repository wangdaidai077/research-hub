"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { FolderKanban, Hourglass, Lightbulb, ListChecks, Search, Flag } from "lucide-react";
import { useDialogs } from "@/components/dialog-store";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Hit = { id: string; kind: "project" | "task" | "idea" | "waiting" | "milestone"; title: string; sub?: string; run: () => void };

export function SearchPalette() {
  const open = useDialogs((s) => s.search);
  const setOpen = useDialogs((s) => s.setSearch);
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const { projects, tasks, ideas, waiting_items, milestones } = useStore();
  const d = useDialogs.getState();

  React.useEffect(() => { if (!open) { setQ(""); setIdx(0); } }, [open]);

  const hits = React.useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return projects.filter((p) => p.status !== "archived").slice(0, 8).map((p) => ({ id: p.id, kind: "project", title: p.title, sub: p.category ?? undefined, run: () => router.push(`/projects/${p.id}`) }));
    const m = (...f: (string | null | undefined)[]) => f.some((x) => x?.toLowerCase().includes(s));
    const pName = (id: string | null) => projects.find((p) => p.id === id)?.title;
    const out: Hit[] = [];
    projects.filter((p) => m(p.title, p.description, p.research_question, p.category, p.collaborators, p.notes))
      .forEach((p) => out.push({ id: p.id, kind: "project", title: p.title, sub: p.category ?? undefined, run: () => router.push(`/projects/${p.id}`) }));
    tasks.filter((t) => m(t.title, t.description, t.notes))
      .forEach((t) => out.push({ id: t.id, kind: "task", title: t.title, sub: pName(t.project_id), run: () => d.openTask(t) }));
    milestones.filter((x) => m(x.title, x.venue, x.notes))
      .forEach((x) => out.push({ id: x.id, kind: "milestone", title: x.title, sub: pName(x.project_id), run: () => d.openMilestone(x) }));
    waiting_items.filter((w) => m(w.waiting_for, w.title, w.reference, w.notes))
      .forEach((w) => out.push({ id: w.id, kind: "waiting", title: w.title || w.waiting_for, sub: `Waiting on ${w.waiting_for}`, run: () => d.openWaiting(w) }));
    ideas.filter((i) => m(i.title, i.question, i.description, i.tags.join(" ")))
      .forEach((i) => out.push({ id: i.id, kind: "idea", title: i.title, sub: i.tags.join(", "), run: () => d.openIdea(i) }));
    return out.slice(0, 40);
  }, [q, projects, tasks, ideas, waiting_items, milestones, router, d]);

  const icon = { project: FolderKanban, task: ListChecks, idea: Lightbulb, waiting: Hourglass, milestone: Flag };
  const go = (h: Hit) => { setOpen(false); setTimeout(h.run, 0); };

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-card shadow-2xl animate-in fade-in-0 slide-in-from-top-2">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search projects, tasks, ideas and waiting items</D.Description>
          <div className="flex items-center gap-2 border-b px-3.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter" && hits[idx]) go(hits[idx]);
              }}
              placeholder="Search projects, tasks, milestones, ideas…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="scroll-thin max-h-[50vh] overflow-y-auto p-1.5">
            {hits.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matches for “{q}”.</p>}
            {!q && hits.length > 0 && <div className="section-label px-2.5 pb-1 pt-1.5">Projects</div>}
            {hits.map((h, i) => {
              const I = icon[h.kind];
              return (
                <button key={h.kind + h.id} onMouseEnter={() => setIdx(i)} onClick={() => go(h)}
                  className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left", i === idx && "bg-accent")}>
                  <I className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-[13px]">{h.title}</span>
                  {h.sub && <span className="ml-auto truncate pl-3 text-[11px] text-muted-foreground">{h.sub}</span>}
                </button>
              );
            })}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
