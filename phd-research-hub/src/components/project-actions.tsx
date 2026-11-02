"use client";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { confirmDialog } from "@/components/ui/confirm";
import { useDialogs } from "@/components/dialog-store";
import { deleteProject, updateProject } from "@/lib/actions";
import { statusKind, statusesOf } from "@/lib/selectors";
import { useStore } from "@/lib/store";
import type { Project } from "@/lib/types";

export function ProjectActions({ project: p, onOpen, onDeleted }: { project: Project; onOpen?: () => void; onDeleted?: () => void }) {
  const settings = useStore((s) => s.settings);
  const openProject = useDialogs((s) => s.openProject);
  const archived = statusKind(settings, p.status) === "archived";
  const archiveKey = statusesOf(settings).find((s) => s.kind === "archived")?.key ?? "archived";
  const activeKey = statusesOf(settings).find((s) => s.kind === "active")?.key ?? "active";
  async function del() {
    if (await confirmDialog({ title: `Delete “${p.title}”?`, description: "This permanently deletes the project with all of its tasks, milestones, waiting items and history. Consider archiving instead.", confirmLabel: "Delete project", destructive: true })) {
      deleteProject(p.id);
      toast.success("Project deleted");
      onDeleted?.();
      return true;
    }
    return false;
  }
  return (
    <Menu>
      <MenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="Project actions"><MoreHorizontal /></Button></MenuTrigger>
      <MenuContent>
        {onOpen && <MenuItem onSelect={onOpen}>Open</MenuItem>}
        <MenuItem onSelect={() => openProject(p)}><Pencil />Edit details</MenuItem>
        {archived
          ? <MenuItem onSelect={() => { updateProject(p.id, { status: activeKey }); toast.success("Project restored"); }}><ArchiveRestore />Unarchive</MenuItem>
          : <MenuItem onSelect={() => { updateProject(p.id, { status: archiveKey }); toast.success("Project archived", { action: { label: "Undo", onClick: () => updateProject(p.id, { status: p.status }) } }); }}><Archive />Archive</MenuItem>}
        <MenuSeparator />
        <MenuItem danger onSelect={del}><Trash2 />Delete</MenuItem>
      </MenuContent>
    </Menu>
  );
}
