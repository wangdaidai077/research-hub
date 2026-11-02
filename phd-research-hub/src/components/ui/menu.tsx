"use client";
import * as React from "react";
import * as M from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ children, align = "end", className }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={4} className={cn("z-50 min-w-[180px] rounded-lg border bg-card p-1 shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95", className)}>
        {children}
      </M.Content>
    </M.Portal>
  );
}
export function MenuItem({ children, onSelect, danger, className }: { children: React.ReactNode; onSelect?: () => void; danger?: boolean; className?: string }) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn("flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground",
        danger && "text-destructive [&_svg]:text-destructive", className)}
    >
      {children}
    </M.Item>
  );
}
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <M.Label className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{children}</M.Label>;
export const MenuSub = M.Sub;
export function MenuSubTrigger({ children }: { children: React.ReactNode }) {
  return <M.SubTrigger className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent data-[state=open]:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground">{children}</M.SubTrigger>;
}
export function MenuSubContent({ children }: { children: React.ReactNode }) {
  return <M.Portal><M.SubContent sideOffset={4} className="z-50 min-w-[160px] rounded-lg border bg-card p-1 shadow-lg">{children}</M.SubContent></M.Portal>;
}
