"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;

export function DialogContent({ title, description, children, className, footer, wide }: {
  title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; className?: string; footer?: React.ReactNode; wide?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-[8vh] z-50 flex max-h-[84vh] w-[calc(100vw-2rem)] -translate-x-1/2 flex-col rounded-xl border bg-card shadow-2xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          wide ? "max-w-3xl" : "max-w-lg",
          className,
        )}
        onOpenAutoFocus={(e) => {
          const el = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-autofocus]");
          if (el) { e.preventDefault(); el.focus(); }
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-3.5">
          <div>
            <D.Title className="text-[15px] font-semibold tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-xs text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">Dialog</D.Description>}
          </div>
          <D.Close className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></D.Close>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
export const DialogClose = D.Close;
