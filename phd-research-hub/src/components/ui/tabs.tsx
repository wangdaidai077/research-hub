"use client";
import * as React from "react";
import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <T.List className={cn("flex gap-1 border-b overflow-x-auto scroll-thin", className)}>{children}</T.List>;
}
export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <T.Trigger value={value} className="relative -mb-px inline-flex outline-none focus-visible:bg-accent items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 pb-2 pt-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-3.5">
      {children}
    </T.Trigger>
  );
}
export const TabsContent = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => (
  <T.Content value={value} className={cn("pt-5 outline-none animate-fade-up", className)}>{children}</T.Content>
);
