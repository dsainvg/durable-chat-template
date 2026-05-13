import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useStore, uid, type Task, type ViewType } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Settings, Plus, MessageSquare } from "lucide-react";
import { ListView } from "@/components/views/ListView";
import { KanbanView } from "@/components/views/KanbanView";
import { CalendarView } from "@/components/views/CalendarView";
import { GanttView } from "@/components/views/GanttView";
import { TaskDialog } from "@/components/TaskDialog";
import { ChannelPanel } from "@/components/ChannelPanel";
import { toast } from "sonner";

export const Route = createFileRoute("/space/$spaceId")({
  component: SpacePage,
});

const VIEW_LABELS: { id: ViewType; label: string }[] = [
  { id: "list", label: "List" },
  { id: "kanban", label: "Kanban" },
  { id: "calendar", label: "Calendar" },
  { id: "gantt", label: "Gantt" },
];

function SpacePage() {
  const { spaceId } = Route.useParams();
  const { state, update } = useStore();
  const navigate = useNavigate();
  const space = state.spaces.find((s) => s.id === spaceId);

  const enabled = useMemo(
    () => VIEW_LABELS.filter((v) => space?.enabledViews[v.id]),
    [space]
  );
  const [view, setView] = useState<ViewType>(enabled[0]?.id ?? "list");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);

  if (!space) {
    return (
      <div className="p-8 text-muted-foreground">
        Space not found. <Link to="/" className="text-primary hover:underline">Go home</Link>
      </div>
    );
  }

  const activeView = space.enabledViews[view] ? view : enabled[0]?.id;

  const updateTask = (t: Task) => {
    update((s) => ({
      ...s,
      spaces: s.spaces.map((sp) =>
        sp.id === spaceId
          ? { ...sp, tasks: sp.tasks.some((x) => x.id === t.id) ? sp.tasks.map((x) => (x.id === t.id ? t : x)) : [...sp.tasks, t] }
          : sp
      ),
    }));
    if (space.emailReminders && state.notificationsEmail) {
      toast.success(`Reminder queued`, {
        description: `Email will be sent to ${state.notificationsEmail} at ${space.emailDigestTime}`,
      });
    }
  };

  const deleteTask = (id: string) => {
    update((s) => ({
      ...s,
      spaces: s.spaces.map((sp) =>
        sp.id === spaceId ? { ...sp, tasks: sp.tasks.filter((t) => t.id !== id) } : sp
      ),
    }));
  };

  const newTask = (): Task => ({
    id: uid(),
    title: "",
    description: "",
    status: space.columns[0]?.id ?? "todo",
    assignee: state.currentUserId,
    dueDate: new Date(Date.now() + 86400_000 * 3).toISOString(),
    startDate: new Date().toISOString(),
    priority: "medium",
    custom: {},
  });

  return (
    <>
      <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/30 flex-shrink-0">
        <div className="flex items-center gap-6 min-w-0">
          <h1 className="text-sm font-semibold truncate flex items-center gap-2">
            <span>{space.emoji}</span>
            {space.name}
          </h1>
          <nav className="flex items-center gap-0.5">
            {enabled.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  activeView === v.id
                    ? "text-primary bg-primary/10 ring-1 ring-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setChannelOpen((o) => !o)}>
            <MessageSquare className="size-4 mr-1.5" />
            Channel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/space/$spaceId/settings", params: { spaceId } })}
          >
            <Settings className="size-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => { setOpenTask(newTask()); setCreating(true); }}
          >
            <Plus className="size-3.5 mr-1" />
            New Task
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto">
          {activeView === "list" && <ListView space={space} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
          {activeView === "kanban" && <KanbanView space={space} onOpen={(t) => { setOpenTask(t); setCreating(false); }} onMove={updateTask} />}
          {activeView === "calendar" && <CalendarView space={space} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
          {activeView === "gantt" && <GanttView space={space} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
        </div>

        {channelOpen && (
          <ChannelPanel space={space} onClose={() => setChannelOpen(false)} />
        )}
      </div>

      {openTask && (
        <TaskDialog
          task={openTask}
          space={space}
          users={state.users}
          isNew={creating}
          onClose={() => setOpenTask(null)}
          onSave={(t) => { updateTask(t); setOpenTask(null); }}
          onDelete={() => { deleteTask(openTask.id); setOpenTask(null); }}
        />
      )}
    </>
  );
}
