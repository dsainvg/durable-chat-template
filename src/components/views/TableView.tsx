import { useMemo } from "react";
import type { Space, Task } from "@/lib/store";
import { useStore } from "@/lib/store";

// Initialize a stable date formatter outside the component to avoid
// recreating it on every render or inside loops, improving performance.
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export function TableView({ space, viewId, onOpen }: { space: Space; viewId?: string; onOpen: (t: Task) => void }) {
  const { state } = useStore();
  const userMap = useMemo(() => Object.fromEntries(state.users.map((u) => [u.id, u])), [state.users]);
  const statusMap: Record<string, string> = {
    todo: "To Do",
    doing: "Doing",
    done: "Done"
  };

  const settings = viewId ? space.views.find(v => v.id === viewId)?.settings : undefined;
  const hiddenFields = settings?.hiddenFields || {};

  const visibleCustomFields = useMemo(() => {
    if (!space.customFields) return [];
    return space.customFields.filter(f => !hiddenFields[f.id]);
  }, [space.customFields, hiddenFields]);

  return (
    <div className="p-6">
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                {!hiddenFields["status"] && <th className="px-4 py-3 font-medium">Status</th>}
                {!hiddenFields["assignee"] && space.columns.includes("assignee") && <th className="px-4 py-3 font-medium">Assignee</th>}
                {!hiddenFields["priority"] && space.columns.includes("priority") && <th className="px-4 py-3 font-medium">Priority</th>}
                {!hiddenFields["dueDate"] && space.columns.includes("dueDate") && <th className="px-4 py-3 font-medium">Due Date</th>}
                {visibleCustomFields.map(f => (
                  <th key={f.id} className="px-4 py-3 font-medium">{f.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {space.tasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground italic">
                    No tasks found
                  </td>
                </tr>
              ) : (
                space.tasks.map((t) => (
                  <tr
                    key={t.id}
                    tabIndex={0}
                    onClick={() => onOpen(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(t);
                      }
                    }}
                    className="hover:bg-accent/40 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-inset"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {space.columns.includes("priority") && (
                          <div className={`size-2 shrink-0 rounded-full ${
                            t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-primary" : "bg-muted-foreground/40"
                          }`} />
                        )}
                        <span className="font-medium truncate max-w-[200px] sm:max-w-[300px]">{t.title}</span>
                      </div>
                    </td>
                    {!hiddenFields["status"] && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                          {statusMap[t.status] || t.status}
                        </span>
                      </td>
                    )}
                    {!hiddenFields["assignee"] && space.columns.includes("assignee") && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[10px]">
                            {userMap[t.assignee]?.initials ?? "?"}
                          </div>
                          <span className="text-muted-foreground text-xs">{userMap[t.assignee]?.name || "Unassigned"}</span>
                        </div>
                      </td>
                    )}
                    {!hiddenFields["priority"] && space.columns.includes("priority") && (
                      <td className="px-4 py-3 whitespace-nowrap capitalize text-muted-foreground text-xs">
                        {t.priority}
                      </td>
                    )}
                    {!hiddenFields["dueDate"] && space.columns.includes("dueDate") && (
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                        {t.dueDate ? dateFormatter.format(new Date(t.dueDate)) : "-"}
                      </td>
                    )}
                    {visibleCustomFields.map(f => (
                      <td key={f.id} className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[150px]">
                        {t.custom[f.id] || "-"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
