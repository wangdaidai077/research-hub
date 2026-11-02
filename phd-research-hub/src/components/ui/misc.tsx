import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface rounded-lg border bg-card text-card-foreground shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]", className)} {...props} />;
}
export function CardHeader({ title, action, subtitle, className }: { title: React.ReactNode; action?: React.ReactNode; subtitle?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-3.5 pb-2", className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  outline: "bg-transparent text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-transparent",
  success: "bg-success/10 text-success border-transparent",
  warning: "bg-warning/10 text-warning border-transparent",
  danger: "bg-destructive/10 text-destructive border-transparent",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-[1px] text-[11px] font-medium leading-[18px] whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export function ProgressBar({ value, className, muted }: { value: number; className?: string; muted?: boolean }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-500", muted ? "bg-foreground/30" : "bg-primary")} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, children, action, className }: {
  icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode; title?: string }[]; className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-md border bg-muted/60 p-0.5", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          title={o.title}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-xs font-medium transition-all [&_svg]:size-3.5",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone, onClick }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "warning" | "danger"; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cn("surface text-left rounded-lg border bg-card px-3.5 py-3 transition-colors", onClick && "hover:border-foreground/20")}>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-serif text-[26px] leading-none tabular-nums", tone === "warning" && "text-warning", tone === "danger" && "text-destructive")}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{sub}</div>}
    </C>
  );
}
