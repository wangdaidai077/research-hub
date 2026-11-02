"use client";
import * as React from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm";
import type { ImageKind } from "@/lib/backend/types";
import { deleteImage, uploadImage, useImageUrl, validateImage } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * Upload / preview / replace / remove one image. Only after a new image has been
 * uploaded successfully is the previous file deleted, so nothing is lost on failure.
 */
export function ImageField({ kind, path, onChange, aspect = "aspect-[3/1]", label, position, round, className }: {
  kind: ImageKind; path: string | null; onChange: (path: string | null) => void;
  aspect?: string; label?: string; position?: number; round?: boolean; className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const { url, loading } = useImageUrl(path);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [url]);

  async function handle(file: File | undefined) {
    if (!file) return;
    try { validateImage(file); } catch (e) { toast.error((e as Error).message); return; }
    setBusy(true);
    try {
      const newPath = await uploadImage(file, kind);
      const old = path;
      onChange(newPath);
      if (old) deleteImage(old);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    if (!path) return;
    if (!(await confirmDialog({ title: "Remove image?", description: "The image file will be deleted from your storage.", confirmLabel: "Remove", destructive: true }))) return;
    const old = path;
    onChange(null);
    await deleteImage(old);
  }

  return (
    <div className={className}>
      {label && <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}
        className={cn(
          "relative overflow-hidden border bg-muted/40 transition-colors",
          round ? "h-20 w-20 rounded-full" : cn(aspect, "w-full rounded-lg"),
          drag && "border-primary ring-2 ring-primary/30",
          !path && "default-cover",
        )}
      >
        {path && url && !failed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `50% ${position ?? 50}%` }} />
        )}
        {path && (failed || (!url && !loading)) && (
          <div className="absolute inset-0 grid place-items-center text-muted-foreground"><span className="flex items-center gap-1.5 text-xs"><ImageOff className="h-4 w-4" />{!round && "Image unavailable"}</span></div>
        )}
        {(busy || (path && loading)) && <div className="absolute inset-0 grid place-items-center bg-background/50"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!path && !busy && (
          <button type="button" onClick={() => inputRef.current?.click()} className="absolute inset-0 grid place-items-center text-xs text-muted-foreground hover:text-foreground">
            <span className="flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" />{!round && "Drop or click to upload · JPG, PNG, WebP"}</span>
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {path ? <><RefreshCw />Replace</> : <><ImagePlus />Upload</>}
        </Button>
        {path && <Button size="sm" variant="ghost" onClick={remove} disabled={busy}><Trash2 />Remove</Button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
    </div>
  );
}

const EMOJIS = ["📘", "📊", "🧪", "🏛️", "🏠", "🏘️", "🌀", "🌊", "🔥", "🚌", "🗺️", "📑", "🧭", "⚖️", "🌱", "🔬", "📈", "🗂️", "✍️", "🎓", "🏙️", "🤝", "💡", "🧩"];

function lastGrapheme(v: string): string | null {
  if (!v.trim()) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Seg = (Intl as any).Segmenter;
  const parts: string[] = Seg ? Array.from(new Seg().segment(v), (x: { segment: string }) => x.segment) : Array.from(v);
  return parts[parts.length - 1] ?? null;
}

export function EmojiPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <div className="grid grid-cols-8 gap-1">
        {EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => onChange(e)}
            className={cn("grid h-8 place-items-center rounded-md text-lg hover:bg-accent", value === e && "bg-accent ring-1 ring-primary/40")}>{e}</button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={value ?? ""}
          onChange={(e) => onChange(lastGrapheme(e.target.value))}
          placeholder="Or type any emoji"
          className="h-7 w-36 rounded-md border bg-card px-2 text-sm"
          aria-label="Custom emoji"
        />
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Clear</Button>}
      </div>
    </div>
  );
}
