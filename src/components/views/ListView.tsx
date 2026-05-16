import { useMemo } from "react";
import type { Space, Task } from "@/lib/store";
import { useStore } from "@/lib/store";

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function ListView({ space, onOpen }: { space: Space; onOpen: (t: Task) => void }) {
  const { state } = useStore();
  const hiddenFields = space.settings?.list?.hiddenFields || {};
  const groupBy = space.settings?.list?.groupBy || "status";
  const userMap = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);

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
    <div className="p-6 space-y-6">
      {columns.map((col) => {
        const tasks = tasksByColumn[col.id] || [];
        return (
          <section key={col.id}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{col.name}</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tasks.length}</span>
            </div>
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border bg-card">
              {tasks.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground italic">No tasks</div>
              )}
              {tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className="w-full px-4 py-3 flex items-center gap-4 hover:bg-accent/40 transition-colors text-left"
                >
                  {!hiddenFields["priority"] && <div className={`size-2 rounded-full ${
                    t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-primary" : "bg-muted-foreground/40"
                  }`} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  </div>
                  {!hiddenFields["dueDate"] && <div className="text-[11px] text-muted-foreground w-24 text-right">
                    {dateFormatter.format(new Date(t.dueDate))}
                  </div>}
                  {!hiddenFields["assignee"] && <div className="size-6 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[10px]">
                    {userMap[t.assignee]?.initials ?? "?"}
                  </div>}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
