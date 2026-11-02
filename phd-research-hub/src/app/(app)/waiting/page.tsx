"use client";
import * as React from "react";
import { addDays } from "date-fns";
import { Check, Hourglass, MailCheck, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, Stat } from "@/components/ui/misc";
import { DueLabel, PageHeader, ProjectLink } from "@/components/bits";
import { useDialogs } from "@/components/dialog-store";
import { logFollowUp, resolveWaiting, updateWaiting } from "@/lib/actions";
import { followUpState, waitingActive } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { WaitingItem } from "@/lib/types";
import { cn, daysUntil, fmtDate, timeAgo, toDateStr } from "@/lib/utils";

export default function WaitingPage() {
  const { waiting_items, tasks } = useStore();
  const openWaiting = useDialogs((s) => s.openWaiting);
  const active = waiting_items.filter(waitingActive).sort((a, b) => (a.follow_up_on ?? "9999") < (b.follow_up_on ?? "9999") ? -1 : 1);
  const overdue = active.filter((w) => followUpState(w) === "overdue");
  const thisWeek = active.filter((w) => followUpState(w) === "this_week");
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const resolved = waiting_items.filter((w) => w.status === "resolved" && (w.resolved_at ?? w.updated_at) >= cutoff)
    .sort((a, b) => ((a.resolved_at ?? "") < (b.resolved_at ?? "") ? 1 : -1));
  const avgWait = (() => {
    const done = waiting_items.filter((w) => w.status === "resolved" && w.resolved_at);
    if (!done.length) return null;
    const d = done.reduce((s, w) => s + Math.max(0, -(daysUntil(w.initiated_on) ?? 0) + (daysUntil(w.resolved_at!.slice(0, 10)) ?? 0)), 0) / done.length;
    return Math.round(d);
  })();

  function Row({ w }: { w: WaitingItem }) {
    const t = w.task_id ? tasks.find((x) => x.id === w.task_id) : null;
    const age = -(daysUntil(w.initiated_on) ?? 0);
    const fs = followUpState(w);
    return (
      <div className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-0 hover:bg-accent/30">
        <Hourglass className={cn("h-4 w-4 shrink-0", fs === "overdue" ? "text-destructive" : "text-warning")} />
        <button className="min-w-[200px] flex-1 text-left" onClick={() => openWaiting(w)}>
          <div className="text-[13px] font-medium">{w.waiting_for}{w.title && <span className="font-normal text-muted-foreground"> — {w.title}</span>}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
            <ProjectLink id={w.project_id} />
            {t && <span>Task: {t.title}</span>}
            <span>Requested {fmtDate(w.initiated_on)} · {age}d ago</span>
            {w.expected_on && <span>Expected {fmtDate(w.expected_on)}</span>}
            {w.reference && <span className="font-mono">#{w.reference}</span>}
            {w.status === "followed_up" && <Badge tone="neutral">Followed up</Badge>}
          </div>
        </button>
        <div className="flex items-center gap-2">
          {w.follow_up_on ? <DueLabel date={w.follow_up_on} prefix="Follow up " /> : <span className="text-[11px] text-muted-foreground">No follow-up date</span>}
          <Button size="sm" variant="ghost" title="Record that you followed up; next follow-up in 7 days" onClick={() => { logFollowUp(w.id, toDateStr(addDays(new Date(), 7))); toast.success("Follow-up logged · next reminder in 7 days"); }}><MailCheck />Followed up</Button>
          <Button size="sm" variant="secondary" onClick={() => { resolveWaiting(w.id); toast.success("Resolved", { description: t ? `“${t.title}” is actionable again.` : undefined }); }}><Check />Resolve</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Waiting tracker" subtitle="External dependencies are tracked here, not counted as delays."
        actions={<Button onClick={() => openWaiting()}><Plus />Waiting item</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active requests" value={active.length} />
        <Stat label="Follow-ups overdue" value={overdue.length} tone={overdue.length ? "danger" : undefined} />
        <Stat label="Follow-ups this week" value={thisWeek.length} tone={thisWeek.length ? "warning" : undefined} />
        <Stat label="Average wait (resolved)" value={avgWait === null ? "—" : `${avgWait}d`} />
      </div>

      {waiting_items.length === 0 ? (
        <EmptyState icon={<Hourglass />} title="Nothing to wait for" action={<Button onClick={() => openWaiting()}>Track a request</Button>}>
          Government data requests, advisor feedback, coauthor comments, journal decisions, IRB approval — log them here with a follow-up date.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && <Card className="border-destructive/30"><CardHeader title="Overdue follow-ups" subtitle="Time to send a polite nudge" />{overdue.map((w) => <Row key={w.id} w={w} />)}</Card>}
          {thisWeek.length > 0 && <Card><CardHeader title="Follow up this week" />{thisWeek.map((w) => <Row key={w.id} w={w} />)}</Card>}
          <Card>
            <CardHeader title="All active waiting items" subtitle={`${active.length} open`} />
            {active.length === 0 ? <p className="px-4 pb-4 text-xs text-muted-foreground">Nothing outstanding.</p> : active.map((w) => <Row key={w.id} w={w} />)}
          </Card>
          <Card>
            <CardHeader title="Recently resolved" subtitle="Last 30 days" />
            {resolved.length === 0 ? <p className="px-4 pb-4 text-xs text-muted-foreground">No resolved items in the last 30 days.</p> : resolved.map((w) => (
              <div key={w.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0">
                <Check className="h-4 w-4 text-success" />
                <button className="min-w-0 flex-1 text-left" onClick={() => openWaiting(w)}>
                  <div className="truncate text-[13px]">{w.waiting_for}{w.title && <span className="text-muted-foreground"> — {w.title}</span>}</div>
                  <div className="text-[11px] text-muted-foreground">Resolved {timeAgo(w.resolved_at)}</div>
                </button>
                <ProjectLink id={w.project_id} />
                <Button size="sm" variant="ghost" onClick={() => updateWaiting(w.id, { status: "waiting", resolved_at: null })}><RotateCcw />Reopen</Button>
              </div>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}
