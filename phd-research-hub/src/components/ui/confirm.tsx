"use client";
import * as React from "react";
import * as A from "@radix-ui/react-alert-dialog";
import { create } from "zustand";
import { Button } from "./button";

interface Req { title: string; description?: string; confirmLabel?: string; destructive?: boolean; resolve: (v: boolean) => void }
const useConfirmStore = create<{ req: Req | null; set: (r: Req | null) => void }>((set) => ({ req: null, set: (req) => set({ req }) }));

/** Imperative confirmation dialog: `if (await confirmDialog({...})) ...` */
export function confirmDialog(opts: Omit<Req, "resolve">): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const { req, set } = useConfirmStore();
  const close = (v: boolean) => { req?.resolve(v); set(null); };
  return (
    <A.Root open={!!req} onOpenChange={(o) => !o && close(false)}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <A.Content className="fixed left-1/2 top-[22vh] z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-xl border bg-card p-5 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <A.Title className="text-[15px] font-semibold">{req?.title}</A.Title>
          <A.Description className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{req?.description ?? "This cannot be undone."}</A.Description>
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel asChild><Button variant="secondary">Cancel</Button></A.Cancel>
            <A.Action asChild>
              <Button variant={req?.destructive ? "destructive" : "default"} onClick={() => close(true)}>{req?.confirmLabel ?? "Confirm"}</Button>
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
