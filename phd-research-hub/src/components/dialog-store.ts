"use client";
import { create } from "zustand";
import type { Idea, Milestone, Project, Task, WaitingItem } from "@/lib/types";

type Open<T> = { initial: Partial<T>; editing: boolean } | null;

interface DialogStore {
  task: Open<Task>;
  project: (Open<Project> & { tab?: "details" | "appearance" }) | null;
  idea: Open<Idea>;
  waiting: Open<WaitingItem>;
  milestone: Open<Milestone>;
  search: boolean;
  openTask(initial?: Partial<Task>): void;
  openProject(initial?: Partial<Project>, tab?: "details" | "appearance"): void;
  openIdea(initial?: Partial<Idea>): void;
  openWaiting(initial?: Partial<WaitingItem>): void;
  openMilestone(initial: Partial<Milestone>): void;
  setSearch(v: boolean): void;
  close(which: "task" | "project" | "idea" | "waiting" | "milestone"): void;
}

/** Any view can open the shared editors; there is exactly one editor per entity type. */
export const useDialogs = create<DialogStore>((set) => ({
  task: null, project: null, idea: null, waiting: null, milestone: null, search: false,
  openTask: (initial = {}) => set({ task: { initial, editing: !!initial.id } }),
  openProject: (initial = {}, tab) => set({ project: { initial, editing: !!initial.id, tab } }),
  openIdea: (initial = {}) => set({ idea: { initial, editing: !!initial.id } }),
  openWaiting: (initial = {}) => set({ waiting: { initial, editing: !!initial.id } }),
  openMilestone: (initial) => set({ milestone: { initial, editing: !!initial.id } }),
  setSearch: (search) => set({ search }),
  close: (which) => set({ [which]: null } as Partial<DialogStore>),
}));
