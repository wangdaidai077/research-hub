"use client";
// Editable starter data. No findings, submission records or deadlines are
// invented — due dates are left empty for you to fill in.
import { addDays } from "date-fns";
import { newIdea, newMilestone, newProject, newTask, newWaiting, normalizeActivity, normalizeDependency } from "./factories";
import { useStore } from "./store";
import type { CognitiveLoad, Priority, Task } from "./types";
import { toDateStr } from "./utils";

export function loadSampleData() {
  const s = useStore.getState();
  // Spread sample work over the coming days so Today and the planner have content.
  const day = (i: number) => toDateStr(addDays(new Date(), i));

  const specs = [
    {
      title: "Beaumont Housing Recovery", category: "Disaster Recovery", phase: "collection", status: "active", priority: "high" as Priority,
      icon: "🏠",
      description: "Housing recovery trajectories in Beaumont, TX using permit, code enforcement and neighbourhood data.",
      question: "How do local administrative capacities shape the pace of post-disaster housing recovery?",
      tasks: [
        ["Follow up on building permit records", "light", "waiting", 0],
        ["Organize code enforcement data", "medium", "next", 1],
        ["Explore neighborhood association data", "medium", "inbox", 3],
      ],
    },
    {
      title: "HOA / NA and Post-Disaster Housing Recovery", category: "Community Governance", phase: "design", status: "active", priority: "high" as Priority,
      icon: "🏘️",
      description: "Whether homeowners' and neighbourhood associations condition housing recovery after disasters.",
      question: "Do community governance institutions (HOAs / NAs) accelerate or stratify post-disaster housing recovery?",
      tasks: [
        ["Develop theoretical mechanisms", "deep", "in_progress", 0],
        ["Operationalize institutional characteristics", "deep", "next", 2],
        ["Evaluate potential data sources", "medium", "next", 4],
      ],
    },
    {
      title: "Florida Disaster Response Case Study", category: "Emergency Management", phase: "idea", status: "backlog", priority: "medium" as Priority,
      icon: "🌀",
      description: "Exploratory case study of multi-actor response coordination in a Florida disaster.",
      question: null,
      tasks: [
        ["Identify response actors", "medium", "inbox", null],
        ["Map response coordination", "deep", "inbox", null],
        ["Explore available after-action reports", "light", "inbox", null],
      ],
    },
    {
      title: "SECO Institutional Pressures", category: "Public Administration", phase: "analysis", status: "maintenance", priority: "medium" as Priority,
      icon: "🏛️",
      description: "Institutional pressures and organisational responses in the SECO context.",
      question: null,
      tasks: [
        ["Review statistical results", "medium", "next", 2],
        ["Refine theoretical discussion", "deep", "inbox", null],
      ],
    },
    {
      title: "NHTS Transportation Study", category: "Transportation Policy", phase: "analysis", status: "maintenance", priority: "low" as Priority,
      icon: "🚌",
      description: "Analysis of National Household Travel Survey data.",
      question: null,
      tasks: [["Review model specifications and interaction effects", "medium", "next", 3]],
    },
  ];

  const projects = [], tasks: Task[] = [], milestones = [], activity = [];
  for (const [pi, sp] of specs.entries()) {
    const p = newProject({
      title: sp.title, category: sp.category, phase: sp.phase, status: sp.status, priority: sp.priority,
      description: sp.description, research_question: sp.question, icon_emoji: sp.icon,
    });
    projects.push(p);
    sp.tasks.forEach(([title, load, status, d], i) => {
      tasks.push(newTask({
        project_id: p.id, title: title as string, cognitive_load: load as CognitiveLoad, status: status as Task["status"],
        priority: i === 0 ? sp.priority : "medium",
        scheduled_date: d === null ? null : day(d as number),
        sort_order: i,
      }));
    });
    activity.push(normalizeActivity({ project_id: p.id, kind: "project", message: `Created project “${p.title}” (sample data)` }));
  }
  // A couple of illustrative milestones without dates
  milestones.push(newMilestone({ project_id: projects[0].id, title: "Assemble permit + code enforcement panel", kind: "milestone" }));
  milestones.push(newMilestone({ project_id: projects[1].id, title: "Finalize research design memo", kind: "milestone" }));
  milestones.push(newMilestone({ project_id: projects[3].id, title: "Complete results review", kind: "milestone" }));

  // Dependency: operationalising characteristics depends on the mechanisms.
  const mech = tasks.find((t) => t.title === "Develop theoretical mechanisms")!;
  const oper = tasks.find((t) => t.title === "Operationalize institutional characteristics")!;
  const deps = [normalizeDependency({ task_id: oper.id, depends_on_id: mech.id })];

  const permit = tasks.find((t) => t.title === "Follow up on building permit records")!;
  const waiting = [newWaiting({
    project_id: projects[0].id, task_id: permit.id, waiting_for: "City permit office",
    title: "Building permit records request", follow_up_on: day(2),
    notes: "Sample entry — replace with your actual request details.",
  })];

  const ideas = [newIdea({
    title: "Recovery equity and code enforcement intensity",
    question: "Does post-disaster code enforcement intensity differ across neighbourhoods?",
    tags: ["Disaster Recovery"], feasibility: "medium",
    notes: "Sample idea — edit or delete.",
  })];

  s.upsert("projects", projects);
  s.upsert("milestones", milestones);
  s.upsert("tasks", tasks);
  s.upsert("task_dependencies", deps);
  s.upsert("waiting_items", waiting);
  s.upsert("ideas", ideas);
  s.upsert("activity_log", activity);
}
