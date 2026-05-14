import { useEffect, useState, useCallback } from "react";

export type ViewType = "list" | "kanban" | "calendar" | "gantt";
export type FieldType = "text" | "number" | "select" | "date";

export interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string; // matches a column id
  assignee: string; // user id
  dueDate: string; // ISO
  startDate: string; // ISO for gantt
  priority: "low" | "medium" | "high";
  custom: Record<string, string>;
}

export interface Space {
  id: string;
  name: string;
  color: string;
  emoji: string;
  enabledViews: Record<ViewType, boolean>;
  columns: { id: string; name: string }[];
  customFields: CustomField[];
  emailReminders: boolean;
  emailDigestTime: string;
  tasks: Task[];
  channel: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  ts: number;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
}

export interface AppState {
  currentUserId: string;
  users: User[];
  spaces: Space[];
  dms: Record<string, ChatMessage[]>; // key = other user id
  theme: "graphite" | "midnight" | "crimson" | "forest";
  notificationsEmail: string;
}

const STORAGE_KEY = "syncduo:v2";

const seed = (): AppState => ({
  currentUserId: "sai",
  theme: "graphite",
  notificationsEmail: "you@example.com",
  users: [
    { id: "sai", name: "SAI", initials: "SA", email: "sam@example.com" },
    { id: "rups", name: "RUPS", initials: "RU", email: "alex@example.com" },
  ],
  spaces: [
    {
      id: "s1",
      name: "Product Engineering",
      color: "emerald",
      emoji: "🛠",
      enabledViews: { list: true, kanban: true, calendar: true, gantt: true },
      columns: [
        { id: "backlog", name: "Backlog" },
        { id: "progress", name: "In Progress" },
        { id: "review", name: "Review" },
        { id: "done", name: "Done" },
      ],
      customFields: [
        { id: "f1", name: "Estimated Hours", type: "number" },
        { id: "f2", name: "Git Branch", type: "text" },
      ],
      emailReminders: true,
      emailDigestTime: "09:00",
      tasks: [
        { id: "t1", title: "Implement auth flow for spaces", description: "JWT + refresh tokens", status: "backlog", assignee: "sai", dueDate: addDays(2), startDate: addDays(0), priority: "high", custom: { f1: "8", f2: "feat/auth" } },
        { id: "t2", title: "Define custom field schema", description: "Per-space task fields", status: "backlog", assignee: "rups", dueDate: addDays(4), startDate: addDays(1), priority: "medium", custom: {} },
        { id: "t3", title: "Refactor sidebar routing", description: "Dynamic space ids", status: "progress", assignee: "sai", dueDate: addDays(1), startDate: addDays(-1), priority: "high", custom: { f1: "4" } },
        { id: "t4", title: "Initial wireframes", description: "Done", status: "done", assignee: "rups", dueDate: addDays(-3), startDate: addDays(-5), priority: "low", custom: {} },
        { id: "t5", title: "Polish kanban drag zones", description: "", status: "review", assignee: "sai", dueDate: addDays(3), startDate: addDays(0), priority: "medium", custom: {} },
      ],
      channel: [
        { id: "c1", userId: "rups", text: "Pushed the auth scaffolding to main.", ts: Date.now() - 3600_000 },
        { id: "c2", userId: "sai", text: "Reviewing now — looks solid.", ts: Date.now() - 1800_000 },
      ],
    },
    {
      id: "s2",
      name: "Growth & Content",
      color: "amber",
      emoji: "📈",
      enabledViews: { list: true, kanban: true, calendar: true, gantt: false },
      columns: [
        { id: "ideas", name: "Ideas" },
        { id: "drafting", name: "Drafting" },
        { id: "published", name: "Published" },
      ],
      customFields: [
        { id: "f1", name: "Channel", type: "select", options: ["Blog", "Twitter", "Newsletter"] },
      ],
      emailReminders: false,
      emailDigestTime: "08:00",
      tasks: [
        { id: "t1", title: "Launch announcement post", description: "Long-form blog", status: "drafting", assignee: "rups", dueDate: addDays(5), startDate: addDays(2), priority: "high", custom: { f1: "Blog" } },
        { id: "t2", title: "Twitter thread on architecture", description: "", status: "ideas", assignee: "sai", dueDate: addDays(7), startDate: addDays(3), priority: "low", custom: { f1: "Twitter" } },
      ],
      channel: [],
    },
  ],
  dms: {
    rups: [
      { id: "d1", userId: "rups", text: "Hey, ready for stand-up?", ts: Date.now() - 7200_000 },
      { id: "d2", userId: "sai", text: "Yep — joining now.", ts: Date.now() - 7100_000 },
    ],
  },
});

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

let cache: AppState | null = null;
const listeners = new Set<() => void>();


if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        cache = JSON.parse(e.newValue);
        listeners.forEach((l) => l());
      } catch (err) {
        console.error("Failed to parse synced state", err);
      }
    }
  });
}

function load(): AppState {
  if (cache) return cache;
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : seed();
  } catch {
    cache = seed();
  }
  return cache!;
}

function save(s: AppState) {
  cache = s;
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

export function useStore() {
  const [, setT] = useState(0);
  useEffect(() => {
    const l = () => setT((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const state = load();
  const update = useCallback((fn: (s: AppState) => AppState) => {
    save(fn(load()));
  }, []);
  return { state, update };
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}
