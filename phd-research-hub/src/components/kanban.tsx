"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Lightweight drag-and-drop board (HTML5 DnD). Moving a card edits the existing record. */
export function Kanban<T extends { id: string }>({ columns, items, columnOf, onMove, renderItem, columnFooter, className, colClassName }: {
  columns: { key: string; label: string; hint?: string }[];
  items: T[];
  columnOf: (item: T) => string;
  onMove: (item: T, column: string) => void;
  renderItem: (item: T) => React.ReactNode;
  columnFooter?: (col: string) => React.ReactNode;
  className?: string;
  colClassName?: string;
}) {
  const [over, setOver] = React.useState<string | null>(null);
  const dragId = React.useRef<string | null>(null);
  return (
    <div className={cn("scroll-thin flex gap-3 overflow-x-auto pb-3", className)}>
      {columns.map((c) => {
        const colItems = items.filter((i) => columnOf(i) === c.key);
        return (
          <div
            key={c.key}
            data-column={c.key}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(c.key); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
            onDrop={(e) => {
              e.preventDefault(); setOver(null);
              const id = dragId.current ?? e.dataTransfer.getData("text/plain");
              const item = items.find((i) => i.id === id);
              if (item && columnOf(item) !== c.key) onMove(item, c.key);
              dragId.current = null;
            }}
            className={cn("surface flex w-[272px] shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors", over === c.key && "border-primary/50 bg-primary/5", colClassName)}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs font-semibold" title={c.hint}>{c.label}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{colItems.length}</span>
            </div>
            <div className="flex min-h-[80px] flex-1 flex-col gap-2 px-2 pb-2">
              {colItems.map((it) => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={(e) => { dragId.current = it.id; e.dataTransfer.setData("text/plain", it.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { dragId.current = null; setOver(null); }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  {renderItem(it)}
                </div>
              ))}
              {columnFooter?.(c.key)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
