import { useState, useMemo } from "react";
import type { Space, Task } from "@/lib/store";
import { useStore } from "@/lib/store";

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function KanbanView({
  viewId,
  space,
  onOpen,
  onMove,
}: {
  space: Space;
  viewId?: string;
  onOpen: (t: Task) => void;
  onMove: (t: Task) => void;
}) {
  const { state } = useStore();
  const settings = viewId ? space.views.find(v => v.id === viewId)?.settings : undefined;
  const hiddenFields = settings?.hiddenFields || {};
  const groupBy = settings?.groupBy || "status";
  const userMap = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const [dragId, setDragId] = useState<string | null>(null);

  const visibleCustomFields = useMemo(() => {
    if (!space.customFields) return [];
    return space.customFields.filter((f) => !hiddenFields[f.id]);
  }, [space.customFields, hiddenFields]);

  const columns = useMemo(() => {
    if (groupBy === "assignee") {
      return state.users.map(u => ({ id: u.id, name: u.name })).concat([{ id: "unassigned", name: "Unassigned" }]);
    } else if (groupBy === "priority") {
      return [
        { id: "high", name: "High" },
        { id: "medium", name: "Medium" },
        { id: "low", name: "Low" },
        { id: "none", name: "None" }
      ];
    }
    return space.columns;
  }, [space.columns, state.users, groupBy]);

  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of space.tasks) {
      const key = groupBy === "assignee" ? (t.assignee || "unassigned") : groupBy === "priority" ? (t.priority || "none") : t.status;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [space.tasks]);

  return (
    <div className="p-6 flex gap-6 overflow-x-auto h-full">
      {columns.map((col) => {
        const tasks = tasksByColumn[col.id] || [];
        return (
          <div
            key={col.id}
            className="w-80 flex-shrink-0 flex flex-col"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId) return;
              const t = space.tasks.find((x) => x.id === dragId);
              if (t) onMove({ ...t, [groupBy]: col.id === "unassigned" ? null : col.id === "none" ? null : col.id });
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
                  {visibleCustomFields.length > 0 && (
                    <div className="space-y-1">
                      {visibleCustomFields.map(f => (
                        <div key={f.id} className="text-[10px] text-muted-foreground truncate flex justify-between items-center">
                          <span className="font-semibold">{f.name}:</span> <span className="truncate ml-2">{t.custom?.[f.id] || "-"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    {!hiddenFields["dueDate"] && <span className="text-[10px] text-muted-foreground">
                      {dateFormatter.format(new Date(t.dueDate))}
                    </span>}
                    {!hiddenFields["assignee"] && <div className="size-5 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[9px]">
                      {userMap[t.assignee]?.initials ?? "?"}
                    </div>}
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
