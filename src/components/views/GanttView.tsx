import { useMemo } from "react";
import type { Space, Task } from "@/lib/store";

export function GanttView({ space, onOpen, onUpdate }: { space: Space; onOpen: (t: Task) => void; onUpdate?: (t: Task) => void }) {
  const tasks = space.tasks;
  if (tasks.length === 0) {
    return <div className="p-8 text-sm text-muted-foreground italic">No tasks to chart yet.</div>;
  }

  const { min, totalDays, days } = useMemo(() => {
    const starts = tasks.map((t) => new Date(t.startDate).getTime());
    const ends = tasks.map((t) => new Date(t.dueDate).getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends);
    const totalDays = Math.max(7, Math.ceil((max - min) / 86400_000) + 1);

    const days = Array.from({ length: totalDays }, (_, i) => {
      return new Date(min + i * 86400_000);
    });

    return { min, totalDays, days };
  }, [tasks]);

  const colWidth = 32;

  return (
    <div className="p-6">
      <div className="rounded-lg border border-border bg-card overflow-auto">
        <div className="min-w-full" style={{ width: `${260 + totalDays * colWidth}px` }}>
          {/* Header */}
          <div className="flex border-b border-border sticky top-0 bg-card z-10">
            <div className="w-[260px] flex-shrink-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Task</div>
            <div className="flex">
              {days.map((d, i) => {
                const isMonthStart = d.getDate() === 1 || i === 0;
                return (
                  <div key={i} style={{ width: colWidth }} className="text-center py-2 text-[10px] text-muted-foreground border-l border-border">
                    {isMonthStart && (
                      <div className="text-[9px] uppercase font-semibold text-foreground">{d.toLocaleDateString(undefined, { month: "short" })}</div>
                    )}
                    <div>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Rows */}
          {tasks.map((t) => {
            const s = new Date(t.startDate).getTime();
            const e = new Date(t.dueDate).getTime();
            const offset = Math.round((s - min) / 86400_000) * colWidth;
            const width = Math.max(colWidth, (Math.round((e - s) / 86400_000) + 1) * colWidth);
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                className="w-full flex border-b border-border hover:bg-accent/30 transition-colors text-left"
              >
                <div className="w-[260px] flex-shrink-0 px-3 py-2.5 text-xs truncate">{t.title}</div>
                <div className="relative flex-1 h-10">
                  <div
                    className={`absolute top-2 h-6 rounded ${
                      t.priority === "high" ? "bg-destructive/70" : t.priority === "medium" ? "bg-primary/70" : "bg-muted-foreground/40"
                    } flex items-center px-2 group/bar`}
                    style={{ left: offset, width }}
                  >
                    <span className="text-[10px] truncate text-primary-foreground select-none">{t.title}</span>
                    {onUpdate && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize opacity-0 group-hover/bar:opacity-100 bg-foreground/20 rounded-r"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const startX = e.clientX;
                          const startDue = new Date(t.dueDate).getTime();

                          const onPointerMove = (moveEvent: PointerEvent) => {
                            // Optionally visual preview, skipping for simplicity
                          };

                          const onPointerUp = (upEvent: PointerEvent) => {
                            document.removeEventListener("pointermove", onPointerMove);
                            document.removeEventListener("pointerup", onPointerUp);

                            const dx = upEvent.clientX - startX;
                            const daysDelta = Math.round(dx / colWidth);
                            if (daysDelta !== 0) {
                              const newDue = new Date(startDue + daysDelta * 86400_000);
                              onUpdate({ ...t, dueDate: newDue.toISOString() });
                            }
                          };

                          document.addEventListener("pointermove", onPointerMove);
                          document.addEventListener("pointerup", onPointerUp);
                        }}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
