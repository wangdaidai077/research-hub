"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import {
  ArrowDown, ArrowUp, Check, Cloud, Database, Download, FileJson, HardDrive, Image as ImageIcon, Laptop, Moon, Palette, Plus, Sun, Trash2, Upload, Layers, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, Segmented } from "@/components/ui/misc";
import { Field, Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { confirmDialog } from "@/components/ui/confirm";
import { PageHeader } from "@/components/bits";
import { ImageField } from "@/components/image-field";
import { ACCENTS, DEFAULT_PHASES, DEFAULT_STATUSES, PIPELINE_STAGES, STATUS_KINDS, VISUAL_THEMES } from "@/lib/constants";
import { exportJSON, exportProjectsCSV, exportTasksCSV, importBackup, parseBackup, type ParsedBackup } from "@/lib/backup";
import { loadSampleData } from "@/lib/sample";
import { phasesOf, statusesOf } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { BackgroundSettings, PhaseDef, StatusDef } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Personalise your workspace and manage your data" />
      <div className="grid grid-cols-1 gap-5">
        <WorkspaceSection />
        <AppearanceSection />
        <BackgroundSection />
        <PhasesSection />
        <DataSection />
      </div>
    </>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2 [&_svg]:size-4 [&_svg]:text-muted-foreground">{icon}{title}</span>} subtitle={subtitle} className="border-b pb-3" />
      <div className="p-4">{children}</div>
    </Card>
  );
}

// ---------------- workspace & profile ----------------
function WorkspaceSection() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  return (
    <Section icon={<Layers />} title="Workspace & profile">
      <div className="flex flex-wrap items-start gap-6">
        <ImageField kind="avatar" round path={settings.avatar_path} onChange={(v) => update({ avatar_path: v })} label="Avatar" />
        <div className="grid min-w-[260px] flex-1 gap-3 sm:grid-cols-2">
          <Field label="Workspace title" hint="Shown at the top of the sidebar">
            <Input defaultValue={settings.workspace_title ?? ""} key={"t" + settings.workspace_title} placeholder="Research Hub" maxLength={40}
              onBlur={(e) => e.target.value !== (settings.workspace_title ?? "") && update({ workspace_title: e.target.value.trim() || null })} />
          </Field>
          <Field label="Subtitle" hint="e.g. your program or lab">
            <Input defaultValue={settings.workspace_subtitle ?? ""} key={"s" + settings.workspace_subtitle} placeholder="PhD research workspace" maxLength={60}
              onBlur={(e) => e.target.value !== (settings.workspace_subtitle ?? "") && update({ workspace_subtitle: e.target.value.trim() || null })} />
          </Field>
        </div>
      </div>
    </Section>
  );
}

// ---------------- appearance ----------------
function AppearanceSection() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const { setTheme } = useTheme();
  const [custom, setCustom] = React.useState(settings.accent);
  React.useEffect(() => setCustom(settings.accent), [settings.accent]);
  return (
    <Section icon={<Palette />} title="Theme" subtitle="Preferences are saved to your account and follow you across devices">
      <div className="grid grid-cols-1 gap-6">
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Mode</div>
          <Segmented value={settings.theme} onChange={(t) => { setTheme(t); update({ theme: t }); }} options={[
            { value: "light", label: <><Sun />Light</> }, { value: "dark", label: <><Moon />Dark</> }, { value: "system", label: <><Laptop />System</> },
          ]} />
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Visual theme</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {VISUAL_THEMES.map((t) => (
              <button key={t.key} onClick={() => update({ visual_theme: t.key })} aria-pressed={settings.visual_theme === t.key}
                className={cn("rounded-lg border p-3 text-left transition-all hover:border-foreground/30", settings.visual_theme === t.key && "border-primary ring-2 ring-primary/20")}>
                <div className="mb-2 flex h-10 overflow-hidden rounded-md border">
                  <div className="flex-1" style={{ background: t.swatch[0] }} /><div className="w-6" style={{ background: t.swatch[2] }} /><div className="w-4" style={{ background: t.swatch[1] }} />
                </div>
                <div className="flex items-center justify-between text-[13px] font-medium">{t.label}{settings.visual_theme === t.key && <Check className="h-3.5 w-3.5 text-primary" />}</div>
                <div className="text-[11px] text-muted-foreground">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Accent colour</div>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((a) => (
              <button key={a.key} title={a.label} aria-label={a.label} onClick={() => update({ accent: a.key })}
                className={cn("grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-card transition-all", settings.accent.toLowerCase() === a.key && "ring-2 ring-foreground/40")} style={{ background: a.key }}>
                {settings.accent.toLowerCase() === a.key && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
              Custom
              <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} onBlur={() => custom !== settings.accent && update({ accent: custom })}
                className="h-8 w-10 cursor-pointer rounded border bg-transparent" aria-label="Custom accent colour" />
              <Button size="sm" variant="ghost" onClick={() => update({ accent: custom })} disabled={custom === settings.accent}>Apply</Button>
            </label>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------------- background ----------------
function BackgroundSection() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const bg = settings.background;
  const [draft, setDraft] = React.useState<BackgroundSettings>(bg);
  React.useEffect(() => setDraft(bg), [bg]);
  const commit = (patch: Partial<BackgroundSettings>) => update({ background: { ...bg, ...draft, ...patch } });
  const slider = (k: "brightness" | "opacity" | "blur" | "overlay", label: string, min: number, max: number, unit: string) => (
    <Field key={k} label={`${label} · ${draft[k] ?? 0}${unit}`}>
      <input type="range" min={min} max={max} value={draft[k] ?? 0} className="w-full accent-[hsl(var(--primary))]" aria-label={label}
        onChange={(e) => { const v = Number(e.target.value); setDraft((d) => ({ ...d, [k]: v })); update({ background: { ...bg, ...draft, [k]: v } }); }} />
    </Field>
  );
  return (
    <Section icon={<ImageIcon />} title="Dashboard background" subtitle="Optional. Panels stay opaque enough to keep text readable.">
      <Segmented value={bg.mode} onChange={(m) => commit({ mode: m })} options={[{ value: "none", label: "None" }, { value: "color", label: "Solid colour" }, { value: "image", label: "Image" }]} />
      {bg.mode !== "none" && (
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            {bg.mode === "image" ? (
              <ImageField kind="background" path={bg.path ?? null} onChange={(v) => commit({ path: v })} aspect="aspect-video" label="Background image" />
            ) : (
              <Field label="Colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={draft.color ?? "#d9d4c7"} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} onBlur={() => commit({})} className="h-9 w-14 cursor-pointer rounded border" aria-label="Background colour" />
                  {["#d9d4c7", "#c9d3dc", "#cfd8cc", "#2b2f36", "#3a2f2a"].map((c) => (
                    <button key={c} onClick={() => commit({ color: c })} className="h-7 w-7 rounded-full border" style={{ background: c }} aria-label={`Use ${c}`} />
                  ))}
                </div>
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {bg.mode === "image" && <>{slider("brightness", "Brightness", 40, 130, "%")}{slider("opacity", "Image visibility", 10, 100, "%")}{slider("blur", "Blur", 0, 24, "px")}</>}
            {slider("overlay", "Readability overlay", 20, 90, "%")}
            <p className="text-[11px] text-muted-foreground">The overlay tints the background with your theme colour; at least 20% is always applied so text keeps adequate contrast.</p>
          </div>
        </div>
      )}
    </Section>
  );
}

// ---------------- phases & statuses ----------------
function PhasesSection() {
  const settings = useStore((s) => s.settings);
  const projects = useStore((s) => s.projects);
  const update = useStore((s) => s.updateSettings);
  const upsert = useStore((s) => s.upsert);
  const phases = phasesOf(settings);
  const statuses = statusesOf(settings);
  const [newPhase, setNewPhase] = React.useState("");
  const [newStatus, setNewStatus] = React.useState("");

  const savePhases = (p: PhaseDef[]) => update({ phases: p });
  const saveStatuses = (s: StatusDef[]) => update({ project_statuses: s });
  const keyOf = (label: string, existing: string[]) => {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item";
    let k = base, i = 2;
    while (existing.includes(k)) k = `${base}_${i++}`;
    return k;
  };
  const move = <T,>(arr: T[], i: number, d: number) => { const a = [...arr]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); return a; };

  async function removePhase(ph: PhaseDef) {
    const using = projects.filter((p) => p.phase === ph.key);
    const fallback = phases.find((x) => x.key !== ph.key);
    if (!fallback) return;
    if (using.length && !(await confirmDialog({ title: `Remove “${ph.label}”?`, description: `${using.length} project(s) use this phase and will be moved to “${fallback.label}”.`, confirmLabel: "Remove phase", destructive: true }))) return;
    if (using.length) upsert("projects", using.map((p) => ({ ...p, phase: fallback.key })));
    savePhases(phases.filter((x) => x.key !== ph.key));
  }
  async function removeStatus(st: StatusDef) {
    const using = projects.filter((p) => p.status === st.key);
    const fallback = statuses.find((x) => x.key !== st.key && x.kind === st.kind) ?? statuses.find((x) => x.key !== st.key);
    if (!fallback) return;
    if (using.length && !(await confirmDialog({ title: `Remove “${st.label}”?`, description: `${using.length} project(s) use this status and will be moved to “${fallback.label}”.`, confirmLabel: "Remove status", destructive: true }))) return;
    if (using.length) upsert("projects", using.map((p) => ({ ...p, status: fallback.key })));
    saveStatuses(statuses.filter((x) => x.key !== st.key));
  }

  return (
    <Section icon={<Layers />} title="Research phases & project statuses" subtitle="Phase and activity status are independent. Each phase maps to a pipeline stage.">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Phases</span>
            {settings.phases && <Button size="sm" variant="ghost" onClick={async () => { if (await confirmDialog({ title: "Restore default phases?", description: "Projects using removed phases keep their phase key until you edit them." })) update({ phases: null }); }}>Reset</Button>}</div>
          <div className="space-y-1.5">
            {phases.map((ph, i) => (
              <div key={ph.key} className="flex items-center gap-1.5">
                <Input defaultValue={ph.label} key={ph.key + ph.label} className="h-7 flex-1 text-xs" aria-label="Phase label"
                  onBlur={(e) => e.target.value.trim() && e.target.value !== ph.label && savePhases(phases.map((x) => x.key === ph.key ? { ...x, label: e.target.value.trim() } : x))} />
                <Select value={ph.stage} onChange={(e) => savePhases(phases.map((x) => x.key === ph.key ? { ...x, stage: e.target.value as PhaseDef["stage"] } : x))} className="h-7 w-[130px] text-xs" aria-label="Pipeline stage">
                  {PIPELINE_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </Select>
                <Badge tone="outline">{projects.filter((p) => p.phase === ph.key).length}</Badge>
                <Button size="icon-sm" variant="ghost" disabled={i === 0} onClick={() => savePhases(move(phases, i, -1))} aria-label="Move up"><ArrowUp /></Button>
                <Button size="icon-sm" variant="ghost" disabled={i === phases.length - 1} onClick={() => savePhases(move(phases, i, 1))} aria-label="Move down"><ArrowDown /></Button>
                <Button size="icon-sm" variant="ghost" disabled={phases.length <= 1} onClick={() => removePhase(ph)} aria-label="Remove phase"><Trash2 /></Button>
              </div>
            ))}
            <form className="flex gap-1.5 pt-1" onSubmit={(e) => { e.preventDefault(); if (!newPhase.trim()) return; savePhases([...phases, { key: keyOf(newPhase, phases.map((p) => p.key)), label: newPhase.trim(), stage: "idea" }]); setNewPhase(""); }}>
              <Input value={newPhase} onChange={(e) => setNewPhase(e.target.value)} placeholder="New phase, e.g. IRB Approval" className="h-7 text-xs" />
              <Button type="submit" size="sm" variant="secondary"><Plus />Add</Button>
            </form>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Activity statuses</span>
            {settings.project_statuses && <Button size="sm" variant="ghost" onClick={() => update({ project_statuses: null })}>Reset</Button>}</div>
          <div className="space-y-1.5">
            {statuses.map((st) => (
              <div key={st.key} className="flex items-center gap-1.5">
                <Input defaultValue={st.label} key={st.key + st.label} className="h-7 flex-1 text-xs" aria-label="Status label"
                  onBlur={(e) => e.target.value.trim() && e.target.value !== st.label && saveStatuses(statuses.map((x) => x.key === st.key ? { ...x, label: e.target.value.trim() } : x))} />
                <Select value={st.kind} onChange={(e) => saveStatuses(statuses.map((x) => x.key === st.key ? { ...x, kind: e.target.value as StatusDef["kind"] } : x))} className="h-7 w-[130px] text-xs" aria-label="Meaning" title="How this status is treated in counts and delay logic">
                  {STATUS_KINDS.map((k) => <option key={k.key} value={k.key}>Behaves as {k.label}</option>)}
                </Select>
                <Badge tone="outline">{projects.filter((p) => p.status === st.key).length}</Badge>
                <Button size="icon-sm" variant="ghost" disabled={statuses.length <= 1} onClick={() => removeStatus(st)} aria-label="Remove status"><Trash2 /></Button>
              </div>
            ))}
            <form className="flex gap-1.5 pt-1" onSubmit={(e) => { e.preventDefault(); if (!newStatus.trim()) return; saveStatuses([...statuses, { key: keyOf(newStatus, statuses.map((s) => s.key)), label: newStatus.trim(), kind: "active" }]); setNewStatus(""); }}>
              <Input value={newStatus} onChange={(e) => setNewStatus(e.target.value)} placeholder="New status, e.g. On Hold" className="h-7 text-xs" />
              <Button type="submit" size="sm" variant="secondary"><Plus />Add</Button>
            </form>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">“Behaves as Waiting” statuses are never shown as behind schedule. Defaults: {DEFAULT_STATUSES.length} statuses, {DEFAULT_PHASES.length} phases.</p>
        </div>
      </div>
    </Section>
  );
}

// ---------------- data, backup, sync ----------------
function DataSection() {
  const backend = useStore((s) => s.backend);
  const queue = useStore((s) => s.queue);
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);
  const syncError = useStore((s) => s.syncError);
  const discardQueue = useStore((s) => s.discardQueue);
  const counts = { p: useStore((s) => s.projects.length), t: useStore((s) => s.tasks.length) };
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = React.useState<ParsedBackup | null>(null);
  const [busy, setBusy] = React.useState(false);
  const demo = backend?.kind === "demo";

  async function onFile(f: File | undefined) {
    if (!f) return;
    try { setParsed(parseBackup(await f.text())); }
    catch (e) { toast.error("Could not read backup", { description: (e as Error).message }); }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function runImport(mode: "merge" | "replace") {
    if (!parsed) return;
    if (mode === "replace" && !(await confirmDialog({ title: "Replace all current data?", description: "Every project, task, milestone, waiting item, idea, weekly plan and history entry in your account will be deleted and replaced by the backup. Export a backup first if unsure.", confirmLabel: "Replace everything", destructive: true }))) return;
    setBusy(true);
    try {
      const res = await importBackup(parsed, mode);
      const added = Object.values(res).reduce((a, b) => a + (Number(b) || 0), 0);
      toast.success(mode === "replace" ? "Backup restored" : `Imported ${added} new record(s)`, { description: mode === "merge" ? "Records already present (same ID) were skipped." : undefined });
      setParsed(null);
    } catch (e) {
      toast.error("Import failed — nothing was changed", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <Section icon={<Database />} title="Data, backup & sync">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3.5 text-[12.5px] leading-relaxed">
            {demo ? (
              <p className="flex gap-2"><HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span><b>Demo mode.</b> Supabase is not configured, so data is stored only in this browser and does not sync. Set the environment variables to use the cloud database.</span></p>
            ) : (
              <p className="flex gap-2"><Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><b>Cloud storage.</b> Every change is saved to your private Supabase database and appears on your other devices when they refresh (open windows update automatically). Uploaded images live in private, per-user storage.</span></p>
            )}
            <p className="mt-2 flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>Row Level Security ensures only your signed-in account can read or change these records.</span></p>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border px-3 py-2"><dt className="text-muted-foreground">Last synced</dt><dd className="mt-0.5 font-medium">{timeAgo(lastSyncedAt)}</dd></div>
            <div className="rounded-md border px-3 py-2"><dt className="text-muted-foreground">Unsaved changes</dt><dd className={cn("mt-0.5 font-medium", queue.length && "text-warning")}>{queue.length}</dd></div>
          </dl>
          {queue.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
              <p>{queue.length} change(s) have not reached the server yet.{syncError && <> Last error: <span className="font-mono">{syncError}</span></>}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => useStore.getState().flush()}>Retry now</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (await confirmDialog({ title: "Discard unsaved changes?", description: "Pending edits that could not be saved will be dropped and the latest server data reloaded.", confirmLabel: "Discard", destructive: true })) discardQueue(); }}>Discard</Button>
              </div>
            </div>
          )}
          <div className="text-[12px] leading-relaxed text-muted-foreground">
            <p><b className="text-foreground">Cloud persistence</b> keeps your live data safe across browsers and devices.</p>
            <p className="mt-1"><b className="text-foreground">Database backups</b> are point-in-time snapshots kept by Supabase (daily on paid plans) for disaster recovery of the whole database.</p>
            <p className="mt-1"><b className="text-foreground">Manual exports</b> (below) are files you own and can store anywhere — the right tool for personal archiving and moving data elsewhere.</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Export</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => { exportJSON(); toast.success("Backup downloaded"); }}><FileJson />Full backup (JSON)</Button>
              <Button variant="secondary" onClick={exportProjectsCSV}><Download />Projects CSV · {counts.p}</Button>
              <Button variant="secondary" onClick={exportTasksCSV}><Download />Tasks CSV · {counts.t}</Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">JSON backups keep every ID and relationship. Image files are not included in backups.</p>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Restore</div>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload />Import JSON backup…</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Sample data</div>
            <Button variant="ghost" onClick={async () => { if (await confirmDialog({ title: "Add sample projects?", description: "Five editable example projects with tasks will be added alongside your data.", confirmLabel: "Add samples" })) { loadSampleData(); toast.success("Sample projects added"); } }}>Load sample projects</Button>
          </div>
        </div>
      </div>

      <Dialog open={!!parsed} onOpenChange={(o) => !o && setParsed(null)}>
        {parsed && (
          <DialogContent title="Import backup" description={`Exported ${new Date(parsed.file.exported_at).toLocaleString()}`}
            footer={<>
              <Button variant="secondary" onClick={() => setParsed(null)} disabled={busy}>Cancel</Button>
              <Button variant="destructive" onClick={() => runImport("replace")} disabled={busy}>Replace all data</Button>
              <Button onClick={() => runImport("merge")} disabled={busy}>Merge (add missing)</Button>
            </>}>
            {parsed.alreadyImported && <p className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">This backup has already been imported into this account. Merging again is safe — existing records are skipped — but nothing new will be added.</p>}
            <table className="w-full text-[13px]">
              <tbody>
                {Object.entries(parsed.counts).map(([k, v]) => <tr key={k} className="border-b last:border-0"><td className="py-1.5 capitalize text-muted-foreground">{k.replace(/_/g, " ")}</td><td className="text-right tabular-nums">{v}</td></tr>)}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground"><b>Merge</b> adds records whose IDs aren't already in your account, so importing the same file twice never creates duplicates. <b>Replace</b> wipes current records and restores the backup exactly, in a single transaction.</p>
          </DialogContent>
        )}
      </Dialog>
    </Section>
  );
}
