import { useState } from "react";
import type { Space, Task } from "@/lib/store";
import { useStore } from "@/lib/store";

export function KanbanView({
  space,
  onOpen,
  onMove,
}: {
  space: Space;
  onOpen: (t: Task) => void;
  onMove: (t: Task) => void;
}) {
  const { state } = useStore();
  const userMap = Object.fromEntries(state.users.map((u) => [u.id, u]));
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="p-6 flex gap-6 overflow-x-auto h-full">
      {space.columns.map((col) => {
        const tasks = space.tasks.filter((t) => t.status === col.id);
        return (
          <div
            key={col.id}
            className="w-80 flex-shrink-0 flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId) return;
              const t = space.tasks.find((x) => x.id === dragId);
              if (t && t.status !== col.id) onMove({ ...t, status: col.id });
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{col.name}</span>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tasks.length}</span>
              </div>
            </div>
            <div className="flex-1 space-y-3 min-h-32">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={() => setDragId(t.id)}
                  onClick={() => onOpen(t)}
                  className={`bg-card p-3 rounded-lg ring-1 ring-border space-y-3 cursor-grab active:cursor-grabbing hover:ring-primary/30 transition-all ${
                    t.priority === "high" ? "border-l-2 border-l-destructive" : t.priority === "medium" ? "border-l-2 border-l-primary" : ""
                  }`}
                >
                  <p className="text-sm leading-snug">{t.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(t.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    <div className="size-5 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[9px]">
                      {userMap[t.assignee]?.initials ?? "?"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
