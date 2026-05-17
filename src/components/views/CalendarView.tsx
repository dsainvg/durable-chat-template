import { useState, useMemo } from "react";
import type { Space, Task } from "@/lib/store";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function CalendarView({ space, viewId, onOpen, onMove }: { space: Space; viewId?: string; onOpen: (t: Task) => void; onMove?: (t: Task) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const [dragId, setDragId] = useState<string | null>(null);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(year, month, d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of space.tasks) {
      const d = new Date(t.dueDate);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }
    return map;
  }, [space.tasks]);

  const today = new Date();
  const hiddenFields = space.settings?.calendar?.hiddenFields || {};

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month" className="p-1.5 rounded hover:bg-accent text-muted-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setCursor(new Date())} className="px-2 text-xs rounded hover:bg-accent text-muted-foreground">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month" className="p-1.5 rounded hover:bg-accent text-muted-foreground">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border overflow-hidden">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="bg-card px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="bg-background h-28" />;
          const k = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const list = tasksByDay.get(k) ?? [];
          const isToday = date.toDateString() === today.toDateString();
          return (
            <div
              key={i}
              className={`bg-card h-28 p-1.5 flex flex-col gap-1 overflow-hidden ${!!onMove ? "cursor-default" : ""}`}
              onDragOver={(e) => {
                if (onMove) e.preventDefault();
              }}
              onDrop={() => {
                if (!dragId || !onMove) return;
                const t = space.tasks.find((x) => x.id === dragId);
                if (t) {
                  // Ensure date retains its time or defaults to noon if not set to prevent timezone shifts
                  const oldDate = new Date(t.dueDate);
                  const newDate = new Date(date);
                  newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds());
                  onMove({ ...t, dueDate: newDate.toISOString() });
                }
                setDragId(null);
              }}
            >
              <span className={`text-[11px] ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{date.getDate()}</span>
              <div className="space-y-0.5 overflow-hidden">
                {list.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    draggable={!!onMove}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDragId(t.id);
                    }}
                    onClick={() => onOpen(t)}
                    className="w-full flex items-center gap-1 text-left text-[10px] truncate px-1.5 py-0.5 rounded bg-primary/15 text-foreground hover:bg-primary/25 cursor-pointer active:cursor-grabbing"
                  >
                    {!hiddenFields["priority"] && (
                      <div className={`size-1.5 shrink-0 rounded-full ${t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    )}
                    <span className="truncate flex-1">
                      {!hiddenFields["title"] ? t.title : "..."}
                      {space.customFields && space.customFields.filter(f => !hiddenFields[f.id]).length > 0 &&
                        ` | ${space.customFields.filter(f => !hiddenFields[f.id]).map(f => t.custom?.[f.id] || "-").join(", ")}`}
                    </span>
                  </button>
                ))}
                {list.length > 3 && <div className="text-[9px] text-muted-foreground px-1">+{list.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
