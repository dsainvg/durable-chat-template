import { useState, useMemo } from "react";
import type { Space, Task } from "@/lib/store";
import { useStore } from "@/lib/store";




const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function ListView({ space, viewId, onOpen, onMove }: { space: Space; viewId?: string; onOpen: (t: Task) => void; onMove?: (t: Task) => void }) {
  const { state } = useStore();

  // Use active settings from the selected view ID or default to "list" logic
  const settings = viewId && space.settings?.[viewId] ? space.settings[viewId] : space.settings?.list;
  const hiddenFields = settings?.hiddenFields || {};
  const groupBy = settings?.groupBy || "status";
  const fieldOrder = settings?.fieldOrder || [
    "status",
    "assignee",
    "priority",
    "dueDate",
    ...(space.customFields || []).map(f => f.id)
  ];
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

  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      {columns.map((col) => {
        const tasks = tasksByColumn[col.id] || [];
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              if (onMove) e.preventDefault();
            }}
            onDrop={() => {
              if (!dragId || !onMove) return;
              const t = space.tasks.find((x) => x.id === dragId);
              if (t) {
                const newVal = col.id === "unassigned" || col.id === "none" ? null : col.id;
                onMove({ ...t, [groupBy]: newVal });
              }
              setDragId(null);
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{col.name}</h3>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tasks.length}</span>
            </div>
            <div className="rounded-lg border border-border overflow-hidden divide-y divide-border bg-card min-h-[48px]">
              {tasks.length === 0 && (
                <div className="px-4 py-3 text-xs text-muted-foreground italic">No tasks</div>
              )}
              {tasks.map((t) => {
                const renderField = (fieldId: string) => {
                  if (hiddenFields[fieldId]) return null;
                  if (fieldId === "priority") {
                    return (
                      <div key={fieldId} className={`size-2 rounded-full shrink-0 ${
                        t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-primary" : "bg-muted-foreground/40"
                      }`} />
                    );
                  }
                  if (fieldId === "dueDate") {
                    return (
                      <div key={fieldId} className="text-[11px] text-muted-foreground w-24 text-right shrink-0">
                        {t.dueDate ? dateFormatter.format(new Date(t.dueDate)) : "-"}
                      </div>
                    );
                  }
                  if (fieldId === "assignee") {
                    return (
                      <div key={fieldId} className="size-6 shrink-0 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[10px]">
                        {userMap[t.assignee]?.initials ?? "?"}
                      </div>
                    );
                  }
                  if (fieldId === "status") return null; // Status is grouped usually, skip rendering explicitly unless needed

                  const customField = space.customFields?.find(f => f.id === fieldId);
                  if (customField) {
                    return (
                      <span key={fieldId} className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                        <span className="font-semibold">{customField.name}:</span> {t.custom?.[fieldId] || "-"}
                      </span>
                    );
                  }
                  return null;
                };

                // Split standard fields from custom fields to maintain core layout:
                // priority indicator on the left, then title/desc + custom fields, then due date/assignee on the right
                const leftSideFields = fieldOrder.filter((id: string) => id === "priority");
                const customFieldsToRender = fieldOrder.filter((id: string) => id !== "priority" && id !== "dueDate" && id !== "assignee" && id !== "status");
                const rightSideFields = fieldOrder.filter((id: string) => id === "dueDate" || id === "assignee");

                return (
                  <div
                    key={t.id}
                    draggable={!!onMove}
                    onDragStart={() => setDragId(t.id)}
                    onClick={() => onOpen(t)}
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-accent/40 transition-colors text-left cursor-pointer active:cursor-grabbing border-b border-border last:border-0"
                  >
                    {leftSideFields.map((id: string) => renderField(id))}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                      {customFieldsToRender.length > 0 && (
                        <div className="flex gap-3 mt-1 overflow-hidden">
                          {customFieldsToRender.map((id: string) => renderField(id))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {rightSideFields.map((id: string) => renderField(id))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
