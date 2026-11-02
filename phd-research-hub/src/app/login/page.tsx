"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { getSupabase, isDemoMode } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "password" | "link" | "reset">(null);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(() => {
    const e = params.get("error");
    if (e === "not_allowed") return { tone: "error", text: "This account is not authorised to use this workspace." };
    if (e === "link_invalid") return { tone: "error", text: "That sign-in link is invalid or has expired. Please request a new one." };
    return null;
  });
  const demo = isDemoMode();

  const next = params.get("next") ?? "/";
  const redirectBase = typeof window !== "undefined" ? window.location.origin : "";

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (demo) { router.replace("/"); return; }
    if (!email || !password) { setMsg({ tone: "error", text: "Enter your email and password." }); return; }
    setBusy("password"); setMsg(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    setBusy(null);
    if (error) { setMsg({ tone: "error", text: error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message }); return; }
    router.replace(next.startsWith("/") ? next : "/");
    router.refresh();
  }

  async function magicLink() {
    if (!email) { setMsg({ tone: "error", text: "Enter your email first." }); return; }
    setBusy("link"); setMsg(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email, options: { shouldCreateUser: false, emailRedirectTo: `${redirectBase}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(null);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: "If this address is registered, a sign-in link is on its way." });
  }

  async function reset() {
    if (!email) { setMsg({ tone: "error", text: "Enter your email first." }); return; }
    setBusy("reset"); setMsg(null);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/auth/callback?next=/auth/update-password`,
    });
    setBusy(null);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: "If this address is registered, a password-reset email is on its way." });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-[360px] animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-xl bg-foreground text-background font-serif text-lg">R</div>
          <h1 className="font-serif text-[28px] tracking-tight">Research Hub</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">A private workspace for your doctoral research.</p>
        </div>
        <form onSubmit={signIn} className="space-y-3.5 rounded-xl border bg-card p-5 shadow-sm">
          {demo && (
            <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
              Demo mode: Supabase is not configured, so data stays in this browser. Click continue.
            </p>
          )}
          {!demo && (
            <>
              <Field label="Email">
                <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" />
              </Field>
              <Field label="Password">
                <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </>
          )}
          {msg && <p className={msg.tone === "error" ? "text-xs text-destructive" : "text-xs text-success"} role="status">{msg.text}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={!!busy}>
            {busy === "password" && <Loader2 className="animate-spin" />} {demo ? "Continue to demo" : "Sign in"}
          </Button>
          {!demo && (
            <div className="flex items-center justify-between pt-1">
              <Button variant="link" className="text-xs" onClick={magicLink} disabled={!!busy}>
                {busy === "link" ? <Loader2 className="animate-spin" /> : <Mail />} Email me a link
              </Button>
              <Button variant="link" className="text-xs text-muted-foreground" onClick={reset} disabled={!!busy}>
                {busy === "reset" ? <Loader2 className="animate-spin" /> : <KeyRound />} Forgot password
              </Button>
            </div>
          )}
        </form>
        <p className="mt-6 text-center text-[11px] text-muted-foreground">Private workspace · sign-ups are disabled</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
