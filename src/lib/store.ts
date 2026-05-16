import { useEffect, useState, useCallback } from "react";

export type ViewType = "list" | "kanban" | "calendar" | "gantt" | "table";
export type FieldType = "text" | "number" | "select" | "date";

export interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
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
  settings: Record<string, any>;
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
}

export const STORAGE_KEY = "syncduo:v5";

const seed = (): AppState => ({
  currentUserId: "",
  theme: "graphite",
  users: [],
  spaces: [],
  dms: {},
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
