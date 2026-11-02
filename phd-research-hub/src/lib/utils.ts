import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  addDays, differenceInCalendarDays, format, isValid, parseISO, startOfWeek,
} from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16));

export const nowISO = () => new Date().toISOString();

/** Local calendar date as yyyy-MM-dd (never UTC-shifted). */
export const toDateStr = (d: Date) => format(d, "yyyy-MM-dd");
export const todayStr = () => toDateStr(new Date());

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = parseISO(s.length === 10 ? s + "T00:00:00" : s);
  return isValid(d) ? d : null;
}

export const weekStartStr = (d: Date = new Date()) => toDateStr(startOfWeek(d, { weekStartsOn: 1 }));
export const weekDays = (weekStart: string) => {
  const s = parseDate(weekStart)!;
  return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(s, i)));
};

export function daysUntil(s: string | null | undefined): number | null {
  const d = parseDate(s);
  if (!d) return null;
  return differenceInCalendarDays(d, new Date());
}

export function fmtDate(s: string | null | undefined, pattern = "MMM d"): string {
  const d = parseDate(s);
  if (!d) return "";
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return format(d, thisYear ? pattern : pattern + ", yyyy");
}

export function relDate(s: string | null | undefined): string {
  const n = daysUntil(s);
  if (n === null) return "";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n}d overdue`;
  if (n < 7) return `in ${n}d`;
  return fmtDate(s);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return format(d, "MMM d, yyyy");
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\r\n");
}

/** "#3b5bdb" → "228 69% 55%" (for CSS hsl() variables) */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Relative luminance check so text on the accent colour stays readable. */
export function readableOn(hex: string): "#ffffff" | "#111111" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return L > 0.45 ? "#111111" : "#ffffff";
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
