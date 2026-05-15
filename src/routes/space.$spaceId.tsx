import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useStore, uid, type Task, type ViewType } from "@/lib/store";
import usePartySocket from "partysocket/react";
import { Button } from "@/components/ui/button";
import { Settings, Plus, MessageSquare } from "lucide-react";
import { ListView } from "@/components/views/ListView";
import { KanbanView } from "@/components/views/KanbanView";
import { CalendarView } from "@/components/views/CalendarView";
import { GanttView } from "@/components/views/GanttView";
import { TableView } from "@/components/views/TableView";
import { TaskDialog } from "@/components/TaskDialog";
import { ChannelPanel } from "@/components/ChannelPanel";
import { SpaceSettingsDialog } from "@/components/SpaceSettingsDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/space/$spaceId")({
  component: SpacePage,
});

const VIEW_LABELS: { id: ViewType; label: string }[] = [
  { id: "list", label: "List" },
  { id: "kanban", label: "Kanban" },
  { id: "calendar", label: "Calendar" },
  { id: "gantt", label: "Gantt" },
  { id: "table", label: "Table" },
];

function SpacePage() {
  const { spaceId } = Route.useParams();
  const { state, update } = useStore();
  const navigate = useNavigate();
  const space = state.spaces.find((s) => s.id === spaceId);

  useEffect(() => {
    async function fetchTasks() {
      const token = localStorage.getItem("syncduo_token");
      if (!token) return;
      try {
        const res = await fetch(`/api/tasks?space_id=${spaceId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const tasks = (await res.json()) as Task[];
          update(s => ({
            ...s,
            spaces: s.spaces.map(sp => sp.id === spaceId ? { ...sp, tasks } : sp)
          }));
        }
      } catch (err) {
        console.error("Failed to fetch tasks", err);
      }
    }
    fetchTasks();
  }, [spaceId, update]);

  const socket = usePartySocket({
    host: typeof window !== "undefined" ? window.location.host : undefined,
    party: "chat",
    room: spaceId,
    onMessage: (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "task_updated") {
          update((s) => ({
            ...s,
            spaces: s.spaces.map((sp) =>
              sp.id === spaceId
                ? {
                    ...sp,
                    tasks: sp.tasks.some((t) => t.id === msg.task.id)
                      ? sp.tasks.map((t) => (t.id === msg.task.id ? msg.task : t))
                      : [...sp.tasks, msg.task],
                  }
                : sp
            ),
          }));
        } else if (msg.type === "space_updated") {
          update((s) => ({
            ...s,
            spaces: s.spaces.map((sp) =>
              sp.id === spaceId
                ? { ...sp, ...msg.space }
                : sp
            ),
          }));
        } else if (msg.type === "task_deleted") {
          update((s) => ({
            ...s,
            spaces: s.spaces.map((sp) =>
              sp.id === spaceId
                ? { ...sp, tasks: sp.tasks.filter((t) => t.id !== msg.id) }
                : sp
            ),
          }));
        } else if (msg.type === "add") {
          update((s) => ({
            ...s,
            spaces: s.spaces.map((sp) =>
              sp.id === spaceId
                ? { ...sp, channel: [...sp.channel, msg].slice(-100) }
                : sp
            ),
          }));
        } else if (msg.type === "all") {
          update((s) => ({
            ...s,
            spaces: s.spaces.map((sp) =>
              sp.id === spaceId ? { ...sp, channel: msg.messages } : sp
            ),
          }));
        }
      } catch (err) {
        console.error("Failed to parse party socket message", err);
      }
    },
  });

  const sendChatMessage = (text: string) => {
    socket.send(JSON.stringify({ type: "add", id: uid(), text, userId: state.currentUserId, ts: Date.now() }));
  };

  const enabled = useMemo(
    () => VIEW_LABELS.filter((v) => space?.enabledViews[v.id]),
    [space]
  );
  const [view, setView] = useState<ViewType>(enabled[0]?.id ?? "list");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!space) {
    return (
      <div className="p-8 text-muted-foreground">
        Space not found. <Link to="/" className="text-primary hover:underline">Go home</Link>
      </div>
    );
  }

  const activeView = space.enabledViews[view] ? view : enabled[0]?.id;

  const updateTask = async (t: Task) => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;

    try {
      const payload = { ...t, space_id: spaceId, notificationsEmail: state.notificationsEmail };
      await fetch(`/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // Optimistic update
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
    } catch (e) {
      console.error("Failed to update task", e);
    }
  };

  const deleteTask = async (id: string) => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;

    try {
      await fetch(`/api/tasks/${id}?space_id=${spaceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      // Optimistic update
      update((s) => ({
        ...s,
        spaces: s.spaces.map((sp) =>
          sp.id === spaceId ? { ...sp, tasks: sp.tasks.filter((t) => t.id !== id) } : sp
        ),
      }));
    } catch (e) {
      console.error("Failed to delete task", e);
    }
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
            onClick={() => setSettingsOpen(true)}
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
          {activeView === "table" && <TableView space={space} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
        </div>

        {channelOpen && (
          <ChannelPanel space={space} onClose={() => setChannelOpen(false)} onSend={sendChatMessage} />
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

      {settingsOpen && (
        <SpaceSettingsDialog
          spaceId={spaceId}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </>
  );
}
