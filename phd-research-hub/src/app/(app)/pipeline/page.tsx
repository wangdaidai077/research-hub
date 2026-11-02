"use client";
import * as React from "react";
import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Flag, Kanban as KanbanIcon, Plus, Rows3, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, Segmented } from "@/components/ui/misc";
import { Checkbox, Select } from "@/components/ui/input";
import { DueLabel, PageHeader, ProjectIcon, ProjectStatusBadge } from "@/components/bits";
import { Kanban } from "@/components/kanban";
import { useDialogs } from "@/components/dialog-store";
import { updateMilestone, updateProject } from "@/lib/actions";
import { MILESTONE_KINDS, PIPELINE_STAGES } from "@/lib/constants";
import { phaseLabel, phaseStage, phasesOf, statusKind } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { PipelineStage } from "@/lib/types";
import { cn, fmtDate, todayStr } from "@/lib/utils";

export default function PipelinePage() {
  const { projects, milestones, settings } = useStore();
  const { openMilestone } = useDialogs();
  const [view, setView] = React.useState<"board" | "table">("board");
  const [includeDone, setIncludeDone] = React.useState(false);
  const phases = phasesOf(settings);
  const visible = projects.filter((p) => {
    const k = statusKind(settings, p.status);
    return k !== "archived" && (includeDone || k !== "completed");
  });
  const counts = PIPELINE_STAGES.map((s) => ({ stage: s.label, key: s.key, n: visible.filter((p) => phaseStage(settings, p.phase) === s.key).length }));
  const early = counts.filter((c) => c.key === "idea" || c.key === "design").reduce((a, c) => a + c.n, 0);
  const late = counts.filter((c) => ["writing", "submission", "review"].includes(c.key)).reduce((a, c) => a + c.n, 0);
  const balance =
    visible.length < 2 ? null
      : early >= 3 && early > late * 2 ? { tone: "warning" as const, text: `${early} projects are in idea/design while only ${late} are in writing, submission or review. Consider pushing one mature project toward a manuscript before starting another.` }
        : late === 0 ? { tone: "warning" as const, text: "No projects are in writing, submission or review. Your publication pipeline has nothing close to output." }
          : { tone: "ok" as const, text: `Balanced: ${early} early-stage, ${late} in writing/review.` };

  const today = todayStr();
  const msOpen = milestones.filter((m) => !m.completed_on).sort((a, b) => (a.due_date ?? "9999") < (b.due_date ?? "9999") ? -1 : 1);
  const msDone = milestones.filter((m) => m.completed_on).sort((a, b) => (a.completed_on! < b.completed_on! ? 1 : -1)).slice(0, 8);

  function moveToStage(pid: string, stage: string) {
    const p = projects.find((x) => x.id === pid);
    if (!p) return;
    const target = phases.find((x) => x.stage === stage);
    if (!target) { toast.error("No research phase is mapped to that stage. Adjust phases in Settings."); return; }
    updateProject(pid, { phase: target.key });
    toast.success(`${p.title} → ${target.label}`);
  }

  return (
    <>
      <PageHeader title="Research pipeline" subtitle="The long arc from idea to publication"
        actions={<><Segmented value={view} onChange={setView} options={[{ value: "board", label: <><KanbanIcon />Board</> }, { value: "table", label: <><Rows3 />Table</> }]} />
          <Button onClick={() => openMilestone({ project_id: visible[0]?.id })} disabled={!projects.length}><Plus />Milestone</Button></>} />

      {projects.length === 0 ? <EmptyState title="No projects in the pipeline yet" /> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Projects by stage" subtitle={`${visible.length} ${includeDone ? "" : "open "}projects`}
                action={<label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} className="accent-[hsl(var(--primary))]" />Include completed</label>} />
              <div className="h-[180px] px-2 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={counts} margin={{ top: 8, right: 12, bottom: 0, left: -18 }} barCategoryGap="28%">
                    <XAxis dataKey="stage" tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={40} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))", radius: 4 }}
                      content={({ active, payload }) => active && payload?.[0] ? (
                        <div className="rounded-md border bg-card px-2.5 py-1.5 text-xs shadow-md">
                          <div className="font-medium">{payload[0].payload.stage}</div>
                          <div className="text-muted-foreground">{payload[0].value} project{payload[0].value === 1 ? "" : "s"}</div>
                        </div>
                      ) : null} />
                    <Bar dataKey="n" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {balance && (
                <div className={cn("mx-4 mb-4 flex items-start gap-2 rounded-md px-3 py-2 text-xs", balance.tone === "warning" ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" />{balance.text}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="Upcoming milestones" />
              <div className="scroll-thin max-h-[250px] overflow-y-auto px-2 pb-2">
                {msOpen.length === 0 ? <p className="px-2 pb-2 text-xs text-muted-foreground">No open milestones.</p> : msOpen.map((m) => {
                  const p = projects.find((x) => x.id === m.project_id);
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60">
                      <Checkbox checked={false} onChange={() => { updateMilestone(m.id, { completed_on: today }); toast.success("Milestone reached"); }} label="Complete milestone" />
                      <button className="min-w-0 flex-1 text-left" onClick={() => openMilestone(m)}>
                        <div className="truncate text-[13px]">{m.title}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{p?.title}</div>
                      </button>
                      {m.due_date && <DueLabel date={m.due_date} />}
                    </div>
                  );
                })}
                {msDone.length > 0 && <div className="section-label px-2 pb-1 pt-3">Recently reached</div>}
                {msDone.map((m) => (
                  <button key={m.id} onClick={() => openMilestone(m)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-accent/60">
                    <Check className="h-3.5 w-3.5 text-success" /><span className="flex-1 truncate text-[12.5px] text-muted-foreground">{m.title}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtDate(m.completed_on)}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-5">
            {view === "board" ? (
              <Kanban
                columns={PIPELINE_STAGES.map((s) => ({ key: s.key, label: s.label, hint: phases.filter((p) => p.stage === s.key).map((p) => p.label).join(", ") }))}
                items={visible}
                columnOf={(p) => phaseStage(settings, p.phase)}
                onMove={(p, col) => moveToStage(p.id, col)}
                colClassName="w-[220px]"
                renderItem={(p) => {
                  const stage = phaseStage(settings, p.phase) as PipelineStage;
                  const options = phases.filter((x) => x.stage === stage);
                  const nextMs = milestones.filter((m) => m.project_id === p.id && !m.completed_on && m.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
                  return (
                    <div className="surface rounded-md border bg-card p-2.5 shadow-sm">
                      <Link href={`/projects/${p.id}`} draggable={false} className="flex items-center gap-2 hover:text-primary"><ProjectIcon project={p} size={16} /><span className="line-clamp-2 text-[13px] font-medium leading-snug">{p.title}</span></Link>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {options.length > 1 ? (
                          <Select value={p.phase} onChange={(e) => updateProject(p.id, { phase: e.target.value })} className="h-6 w-auto text-[11px]" aria-label="Phase">
                            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                          </Select>
                        ) : <Badge tone="outline">{phaseLabel(settings, p.phase)}</Badge>}
                        <ProjectStatusBadge status={p.status} />
                      </div>
                      {nextMs && <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Flag className="h-3 w-3" /><span className="truncate">{nextMs.title}</span><DueLabel date={nextMs.due_date} className="ml-auto" /></div>}
                    </div>
                  );
                }}
              />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-[13px]">
                  <thead className="border-b text-left text-[11px] text-muted-foreground">
                    <tr><th className="px-4 py-2 font-medium">Project</th><th className="px-3 font-medium">Stage</th><th className="px-3 font-medium">Phase</th><th className="px-3 font-medium">Milestones</th><th className="px-3 font-medium">Submission</th><th className="px-3 font-medium">Latest decision</th><th className="px-3 font-medium">Revision due</th><th className="px-3 font-medium">Next milestone</th></tr>
                  </thead>
                  <tbody>
                    {[...visible].sort((a, b) => PIPELINE_STAGES.findIndex((s) => s.key === phaseStage(settings, b.phase)) - PIPELINE_STAGES.findIndex((s) => s.key === phaseStage(settings, a.phase))).map((p) => {
                      const ms = milestones.filter((m) => m.project_id === p.id);
                      const sub = ms.filter((m) => m.kind === "submission").sort((a, b) => ((a.due_date ?? a.completed_on ?? "") < (b.due_date ?? b.completed_on ?? "") ? 1 : -1))[0];
                      const dec = ms.filter((m) => m.decision).sort((a, b) => ((a.completed_on ?? a.due_date ?? "") < (b.completed_on ?? b.due_date ?? "") ? 1 : -1))[0];
                      const rev = ms.filter((m) => m.kind === "revision" && !m.completed_on && m.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
                      const nx = ms.filter((m) => !m.completed_on && m.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-accent/40">
                          <td className="px-4 py-2"><Link href={`/projects/${p.id}?tab=milestones`} className="flex items-center gap-2 font-medium hover:text-primary"><ProjectIcon project={p} size={16} />{p.title}</Link></td>
                          <td className="px-3">
                            <Select value={phaseStage(settings, p.phase)} onChange={(e) => moveToStage(p.id, e.target.value)} className="h-7 w-[140px] border-transparent bg-transparent text-xs shadow-none hover:border-input" aria-label="Stage">
                              {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </Select>
                          </td>
                          <td className="px-3 text-xs text-muted-foreground">{phaseLabel(settings, p.phase)}</td>
                          <td className="px-3 text-xs tabular-nums">{ms.filter((m) => m.completed_on).length}/{ms.length}</td>
                          <td className="px-3 text-xs">{sub ? <>{sub.venue ?? "—"} <span className="text-muted-foreground">{fmtDate(sub.completed_on ?? sub.due_date)}</span></> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 text-xs">{dec ? <Badge tone={dec.decision === "Accept" ? "success" : "neutral"}>{dec.decision}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3">{rev ? <DueLabel date={rev.due_date} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                          <td className="px-3 text-xs">{nx ? <span className="flex items-center gap-2"><span className="truncate max-w-[160px]">{nx.title}</span><DueLabel date={nx.due_date} /></span> : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">Record submissions, journal decisions and revision deadlines as milestones of the matching type ({MILESTONE_KINDS.slice(1).map((k) => k.label.toLowerCase()).join(", ")}).</p>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
