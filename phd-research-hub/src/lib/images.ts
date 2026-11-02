"use client";
import { useEffect, useState } from "react";
import { IMAGE_LIMITS } from "./constants";
import type { ImageKind } from "./backend/types";
import { useStore } from "./store";

const MAX_DIM: Record<ImageKind, number> = { background: 2400, cover: 1800, icon: 256, avatar: 384 };
const QUALITY: Record<ImageKind, number> = { background: 0.82, cover: 0.84, icon: 0.9, avatar: 0.9 };

export class ImageError extends Error {}

export function validateImage(file: File) {
  if (!IMAGE_LIMITS.acceptedTypes.includes(file.type))
    throw new ImageError("Please choose a JPG, PNG or WebP image.");
  if (file.size > IMAGE_LIMITS.maxInputBytes)
    throw new ImageError(`That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 15 MB.`);
}

/** Downscale + re-encode in the browser so uploads stay small and fast. */
export async function compressImage(file: File, kind: ImageKind): Promise<Blob> {
  validateImage(file);
  const bmp = await loadBitmap(file);
  const max = MAX_DIM[kind];
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("This browser cannot process images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp as CanvasImageSource, 0, 0, w, h);
  if ("close" in bmp && typeof bmp.close === "function") bmp.close();
  let blob = await toBlob(canvas, "image/webp", QUALITY[kind]);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", QUALITY[kind]);
  if (!blob) throw new ImageError("Could not encode the image.");
  if (blob.size > IMAGE_LIMITS.maxStoredBytes) blob = (await toBlob(canvas, "image/jpeg", 0.7)) ?? blob;
  if (blob.size > IMAGE_LIMITS.maxStoredBytes) throw new ImageError("Image is still larger than 5 MB after compression.");
  return blob;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file); } catch { /* fall back */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new ImageError("The image could not be read. It may be corrupted."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>((res) => c.toBlob(res, type, q));

export async function uploadImage(file: File, kind: ImageKind): Promise<string> {
  const backend = useStore.getState().backend;
  if (!backend) throw new ImageError("Not connected.");
  const blob = await compressImage(file, kind);
  return backend.uploadImage(kind, blob);
}

export async function deleteImage(path: string | null | undefined) {
  if (!path) return;
  try { await useStore.getState().backend?.deleteImage(path); } catch { /* orphan is harmless */ }
}

// ---------- signed URL resolution (batched + cached) ----------
const TTL = 5 * 60 * 60 * 1000; // signed URLs live 6h; refresh after 5h
const store = new Map<string, { u: string; t: number }>();
const cache = {
  has: (p: string) => { const e = store.get(p); return !!e && Date.now() - e.t < TTL; },
  get: (p: string) => store.get(p)?.u,
  set: (p: string, u: string) => store.set(p, { u, t: Date.now() }),
};
const pending = new Map<string, ((u: string | null) => void)[]>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

function requestUrl(path: string): Promise<string | null> {
  if (cache.has(path)) return Promise.resolve(cache.get(path)!);
  return new Promise((resolve) => {
    pending.set(path, [...(pending.get(path) ?? []), resolve]);
    if (!batchTimer) batchTimer = setTimeout(runBatch, 20);
  });
}
async function runBatch() {
  batchTimer = null;
  const paths = Array.from(pending.keys());
  const waiters = new Map(pending);
  pending.clear();
  let urls: Record<string, string> = {};
  try { urls = (await useStore.getState().backend?.signedUrls(paths)) ?? {}; } catch { urls = {}; }
  for (const p of paths) {
    const u = urls[p] ?? null;
    if (u) cache.set(p, u);
    waiters.get(p)?.forEach((fn) => fn(u));
  }
}

/** Resolve a stored image path to a displayable URL; null = none / failed. */
export function useImageUrl(path: string | null | undefined): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(path ? cache.get(path) ?? null : null);
  const [loading, setLoading] = useState<boolean>(!!path && !cache.has(path));
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); setLoading(false); return; }
    if (cache.has(path)) { setUrl(cache.get(path)!); setLoading(false); return; }
    setLoading(true);
    requestUrl(path).then((u) => { if (alive) { setUrl(u); setLoading(false); } });
    return () => { alive = false; };
  }, [path]);
  return { url, loading };
}
