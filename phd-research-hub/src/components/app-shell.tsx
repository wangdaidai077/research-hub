"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CalendarDays, CalendarRange, Check, CloudOff, FolderKanban, GitBranch, Hourglass, Lightbulb, LayoutDashboard, ListChecks,
  Loader2, LogOut, Menu as MenuIcon, Moon, Plus, Search, Settings, Sun, Sunrise, AlertTriangle, X, Laptop,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useDialogs } from "@/components/dialog-store";
import { TaskDialogHost } from "@/components/forms/task-dialog";
import { ProjectDialogHost } from "@/components/forms/project-dialog";
import { IdeaDialogHost, MilestoneDialogHost, WaitingDialogHost } from "@/components/forms/other-dialogs";
import { SearchPalette } from "@/components/search-palette";
import { DemoBackend } from "@/lib/backend/demo-backend";
import { SupabaseBackend } from "@/lib/backend/supabase-backend";
import { useImageUrl } from "@/lib/images";
import { followUpState, isOpenTask, isTaskOverdue } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import { getSupabase, isDemoMode } from "@/lib/supabase/client";
import { cn, hexToHslTriplet, readableOn, todayStr } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/today", label: "Today", icon: Sunrise, badge: "today" as const },
  { href: "/planner", label: "Weekly Planner", icon: CalendarRange },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "All Tasks", icon: ListChecks, badge: "overdue" as const },
  { href: "/pipeline", label: "Research Pipeline", icon: GitBranch },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/waiting", label: "Waiting Tracker", icon: Hourglass, badge: "followups" as const },
  { href: "/ideas", label: "Idea Backlog", icon: Lightbulb },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ready = useStore((s) => s.ready);
  const [fatal, setFatal] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);

  // ---------- bootstrap: pick backend, load data, keep in sync ----------
  React.useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const store = useStore.getState();
        if (isDemoMode()) {
          const b = new DemoBackend();
          await store.init(b, "demo");
          setEmail("Demo mode (this browser only)");
          cleanup = b.subscribe(() => useStore.getState().reload());
          return;
        }
        const sb = getSupabase();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { router.replace("/login"); return; }
        if (cancelled) return;
        setEmail(user.email ?? null);
        const b = new SupabaseBackend(sb, user.id);
        await store.init(b, user.id);
        let t: ReturnType<typeof setTimeout> | null = null;
        const unsub = b.subscribe(() => { if (t) clearTimeout(t); t = setTimeout(() => useStore.getState().reload(), 600); });
        const { data: authSub } = sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") router.replace("/login"); });
        cleanup = () => { unsub(); authSub.subscription.unsubscribe(); };
      } catch (e) {
        setFatal((e as Error).message ?? "Could not load your data.");
      }
    })();
    const onFocus = () => { if (document.visibilityState === "visible") useStore.getState().reload(); };
    const onOnline = () => useStore.getState().flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (useStore.getState().queue.length) { e.preventDefault(); e.returnValue = ""; } };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      cancelled = true; cleanup?.();
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [router]);

  // ---------- global shortcuts ----------
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); useDialogs.getState().setSearch(true); }
      else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && !document.querySelector("[role=dialog]")) {
        if (e.key === "n") { e.preventDefault(); useDialogs.getState().openTask({ scheduled_date: null }); }
        if (e.key === "i") { e.preventDefault(); useDialogs.getState().openIdea(); }
        if (e.key === "/") { e.preventDefault(); useDialogs.getState().setSearch(true); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <Appearance>
      <div className="flex min-h-screen">
        <Sidebar email={email} />
        <main className="relative min-w-0 flex-1">
          <MobileBar />
          {fatal ? (
            <div className="mx-auto max-w-md p-10 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
              <p className="mt-3 text-sm font-medium">Could not connect to your database</p>
              <p className="mt-1 text-xs text-muted-foreground">{fatal}</p>
              <Button className="mt-4" onClick={() => location.reload()}>Try again</Button>
            </div>
          ) : !ready ? (
            <LoadingSkeleton />
          ) : (
            <div className="mx-auto w-full max-w-[1280px] px-5 pb-16 pt-6 md:px-8 md:pt-8 animate-fade-up">{children}</div>
          )}
        </main>
      </div>
      {ready && (
        <>
          <TaskDialogHost /><ProjectDialogHost /><IdeaDialogHost /><WaitingDialogHost /><MilestoneDialogHost /><SearchPalette />
        </>
      )}
    </Appearance>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] px-8 pt-10">
      <div className="h-7 w-56 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-lg bg-muted" />)}</div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading your research workspace…</p>
    </div>
  );
}

// ---------- appearance: theme, visual theme, accent, background ----------
function Appearance({ children }: { children: React.ReactNode }) {
  const settings = useStore((s) => s.settings);
  const ready = useStore((s) => s.ready);
  const { setTheme, theme } = useTheme();
  const bg = settings.background;
  const { url } = useImageUrl(bg.mode === "image" ? bg.path : null);
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => setImgFailed(false), [url]);

  // Preference stored in the database follows you across devices.
  React.useEffect(() => { if (ready && settings.theme && settings.theme !== theme) setTheme(settings.theme); /* eslint-disable-next-line */ }, [ready, settings.theme]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.dataset.vt = settings.visual_theme || "graphite";
    const hsl = hexToHslTriplet(settings.accent);
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--primary-foreground", readableOn(settings.accent) === "#ffffff" ? "0 0% 100%" : "0 0% 7%");
    }
  }, [settings.visual_theme, settings.accent]);

  const hasImage = bg.mode === "image" && !!url && !imgFailed;
  const hasColor = bg.mode === "color" && !!bg.color;
  return (
    <div className={cn("relative", (hasImage || hasColor) && "has-bg")}>
      {hasImage && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url!} alt="" onError={() => setImgFailed(true)} className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: `brightness(${(bg.brightness ?? 100) / 100}) blur(${bg.blur ?? 0}px)`,
              opacity: (bg.opacity ?? 100) / 100,
              transform: (bg.blur ?? 0) > 0 ? "scale(1.04)" : undefined,
            }} />
          <div className="absolute inset-0 bg-background" style={{ opacity: (bg.overlay ?? 55) / 100 }} />
        </div>
      )}
      {hasColor && (
        <div aria-hidden className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0" style={{ background: bg.color }} />
          <div className="absolute inset-0 bg-background" style={{ opacity: (bg.overlay ?? 55) / 100 }} />
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

// ---------- sidebar ----------
function useNavCounts() {
  const tasks = useStore((s) => s.tasks);
  const waiting = useStore((s) => s.waiting_items);
  const today = todayStr();
  return {
    today: tasks.filter((t) => isOpenTask(t) && t.scheduled_date === today).length,
    overdue: tasks.filter(isTaskOverdue).length,
    followups: waiting.filter((w) => { const s = followUpState(w); return s === "overdue" || (s === "this_week" && w.follow_up_on! <= today); }).length,
  };
}

function SidebarContent({ email, onNavigate }: { email: string | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const counts = useNavCounts();
  const settings = useStore((s) => s.settings);
  const openTask = useDialogs((s) => s.openTask);
  const openIdea = useDialogs((s) => s.openIdea);
  const setSearch = useDialogs((s) => s.setSearch);
  const { url: avatar } = useImageUrl(settings.avatar_path);
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const title = settings.workspace_title || "Research Hub";
  const subtitle = settings.workspace_subtitle || "PhD research workspace";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        {avatar && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" onError={() => setAvatarFailed(true)} className="h-8 w-8 rounded-full object-cover ring-1 ring-border" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-foreground font-serif text-[15px] text-background">{title[0]?.toUpperCase()}</div>
        )}
        <div className="min-w-0">
          <div className="truncate font-serif text-[15px] font-medium leading-tight">{title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <button onClick={() => setSearch(true)} className="flex h-8 w-full items-center gap-2 rounded-md border bg-card/70 px-2.5 text-[13px] text-muted-foreground hover:text-foreground">
          <Search className="h-3.5 w-3.5" />Search
          <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-2 py-1">
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          const c = n.badge ? counts[n.badge] : 0;
          return (
            <Link key={n.href} href={n.href} onClick={onNavigate}
              className={cn("group mb-px flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                active ? "bg-accent font-medium text-foreground" : "text-foreground/70 hover:bg-accent/60 hover:text-foreground")}>
              <n.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {n.label}
              {c > 0 && (
                <span className={cn("ml-auto rounded px-1.5 text-[10px] font-semibold tabular-nums",
                  n.badge === "overdue" ? "bg-destructive/10 text-destructive" : n.badge === "followups" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")}>{c}</span>
              )}
            </Link>
          );
        })}
        <div className="section-label mb-1.5 mt-5 px-2.5">Capture</div>
        <button onClick={() => { onNavigate?.(); openTask(); }} className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] text-foreground/70 hover:bg-accent/60 hover:text-foreground">
          <Plus className="h-4 w-4 text-muted-foreground" />New task<kbd className="ml-auto font-mono text-[10px] text-muted-foreground">N</kbd>
        </button>
        <button onClick={() => { onNavigate?.(); openIdea(); }} className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] text-foreground/70 hover:bg-accent/60 hover:text-foreground">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />Capture idea<kbd className="ml-auto font-mono text-[10px] text-muted-foreground">I</kbd>
        </button>
      </nav>
      <div className="border-t p-2">
        <SyncIndicator />
        <div className="flex items-center gap-1">
          <Link href="/settings" onClick={onNavigate} className={cn("flex h-8 flex-1 items-center gap-2.5 rounded-md px-2.5 text-[13px] text-foreground/70 hover:bg-accent/60 hover:text-foreground", pathname.startsWith("/settings") && "bg-accent text-foreground")}>
            <Settings className="h-4 w-4 text-muted-foreground" />Settings
          </Link>
          <ThemeMenu />
          <AccountMenu email={email} />
        </div>
      </div>
    </div>
  );
}

function Sidebar({ email }: { email: string | null }) {
  return (
    <aside className="surface sticky top-0 hidden h-screen w-[236px] shrink-0 border-r bg-sidebar md:block">
      <SidebarContent email={email} />
    </aside>
  );
}

function MobileBar() {
  const [open, setOpen] = React.useState(false);
  const settings = useStore((s) => s.settings);
  return (
    <>
      <div className="surface sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:hidden">
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon /></Button>
        <span className="font-serif text-[15px]">{settings.workspace_title || "Research Hub"}</span>
        <div className="ml-auto"><Button size="icon" variant="ghost" onClick={() => useDialogs.getState().openTask()} aria-label="New task"><Plus /></Button></div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] bg-sidebar shadow-xl animate-in slide-in-from-left">
            <button className="absolute right-2 top-3 p-1 text-muted-foreground" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button>
            <SidebarContent email={null} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function ThemeMenu() {
  const { resolvedTheme, setTheme } = useTheme();
  const update = useStore((s) => s.updateSettings);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const pick = (t: "light" | "dark" | "system") => { setTheme(t); update({ theme: t }); };
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Theme">{mounted && resolvedTheme === "dark" ? <Moon /> : <Sun />}</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => pick("light")}><Sun />Light</MenuItem>
        <MenuItem onSelect={() => pick("dark")}><Moon />Dark</MenuItem>
        <MenuItem onSelect={() => pick("system")}><Laptop />System</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function AccountMenu({ email }: { email: string | null }) {
  const router = useRouter();
  const queue = useStore((s) => s.queue);
  async function signOut() {
    if (queue.length) { toast.error("Some changes are still saving. Please wait a moment."); return; }
    if (isDemoMode()) { router.push("/login"); return; }
    await getSupabase().auth.signOut();
    router.replace("/login");
  }
  return (
    <Menu>
      <MenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Account"><LogOut /></Button></MenuTrigger>
      <MenuContent>
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground truncate max-w-[220px]">{email ?? "Signed in"}</div>
        <MenuSeparator />
        <MenuItem onSelect={signOut}><LogOut />Sign out</MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function SyncIndicator() {
  const sync = useStore((s) => s.sync);
  const queue = useStore((s) => s.queue);
  const err = useStore((s) => s.syncError);
  const flush = useStore((s) => s.flush);
  const backend = useStore((s) => s.backend);
  const map = {
    idle: { i: <Check className="h-3 w-3" />, t: backend?.kind === "demo" ? "Saved in this browser" : "All changes saved", c: "text-muted-foreground" },
    saved: { i: <Check className="h-3 w-3" />, t: "Saved", c: "text-success" },
    loading: { i: <Loader2 className="h-3 w-3 animate-spin" />, t: "Loading…", c: "text-muted-foreground" },
    saving: { i: <Loader2 className="h-3 w-3 animate-spin" />, t: "Saving…", c: "text-muted-foreground" },
    offline: { i: <CloudOff className="h-3 w-3" />, t: `Offline · ${queue.length} unsaved`, c: "text-warning" },
    error: { i: <AlertTriangle className="h-3 w-3" />, t: `Not saved · ${queue.length} pending`, c: "text-destructive" },
  }[sync];
  return (
    <div className={cn("mb-1 flex items-center gap-1.5 px-2.5 py-1 text-[11px]", map.c)} title={err ?? undefined} role="status" aria-live="polite">
      {map.i}<span className="truncate">{map.t}</span>
      {(sync === "error" || sync === "offline") && <button onClick={() => flush()} className="ml-auto underline">Retry</button>}
    </div>
  );
}
