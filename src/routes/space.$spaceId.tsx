import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useStore, uid, type Task, type ViewType } from "@/lib/store";
import usePartySocket from "partysocket/react";
import { Button } from "@/components/ui/button";
import { Settings, Plus, MessageSquare } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Filter, ArrowUpDown, SlidersHorizontal, ChevronDown } from "lucide-react";
import { ListView } from "@/components/views/ListView";
import { KanbanView } from "@/components/views/KanbanView";
import { CalendarView } from "@/components/views/CalendarView";
import { GanttView } from "@/components/views/GanttView";
import { TableView } from "@/components/views/TableView";
import { TaskDialog } from "@/components/TaskDialog";
import { ChannelPanel } from "@/components/ChannelPanel";
import { SpaceSettingsDialog } from "@/components/SpaceSettingsDialog";
import { toast } from "sonner";
import { ImportDialog } from "@/components/import/ImportDialog";
import { exportTasksToExcel } from "@/lib/ImportExportUtils";
import { Download, Upload } from "lucide-react";

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

  const views = useMemo(() => space?.views || [], [space]);
  const [viewId, setViewId] = useState<string>(views[0]?.id ?? "list");
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  if (!space) {
    return (
      <div className="p-8 text-muted-foreground">
        Space not found. <Link to="/" className="text-primary hover:underline">Go home</Link>
      </div>
    );
  }

  const activeView = views.find(v => v.id === viewId) || views[0];
  const activeViewId = activeView?.id;
  const activeViewType = activeView?.type;

  const viewSettings = activeView?.settings || {};
  const sortField = viewSettings.sortField || "default";
  const sortDirection = viewSettings.sortDirection || "asc";
  const filterAssignee = viewSettings.filterAssignee || "all";
  const filterPriority = viewSettings.filterPriority || "all";
  const filterStatus = viewSettings.filterStatus || "all";

  const setViewSetting = async (key: string, value: string) => {
    if (!activeViewId) return;
    const newViews = space.views.map(v => v.id === activeViewId ? {
      ...v,
      settings: {
        ...(v.settings || {}),
        [key]: value
      }
    } : v);

    const updatedSpace = { ...space, views: newViews };

    update(s => ({
      ...s,
      spaces: s.spaces.map(sp => sp.id === spaceId ? updatedSpace : sp)
    }));

    const token = localStorage.getItem("syncduo_token");
    if (token) {
      try {
        await fetch(`/api/spaces/${spaceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(updatedSpace)
        });
      } catch (e) {
        toast.error("Failed to sync view settings");
      }
    }
  };

  const processedSpace = useMemo(() => {
    if (!space) return space;
    let tasks = [...space.tasks];

    // Filter
    if (filterAssignee !== "all") {
      tasks = tasks.filter(t => t.assignee === filterAssignee || (filterAssignee === "unassigned" && !t.assignee));
    }
    if (filterPriority !== "all") {
      tasks = tasks.filter(t => t.priority === filterPriority);
    }
    if (filterStatus !== "all") {
      tasks = tasks.filter(t => t.status === filterStatus);
    }

    // Sort
    if (sortField !== "default") {
      tasks.sort((a, b) => {
        let valA: any = a[sortField as keyof Task] || (a.custom && a.custom[sortField]);
        let valB: any = b[sortField as keyof Task] || (b.custom && b.custom[sortField]);

        if (sortField === "dueDate") {
          valA = new Date(valA || "9999-12-31").getTime();
          valB = new Date(valB || "9999-12-31").getTime();
        } else if (sortField === "priority") {
          const p: Record<string, number> = { high: 1, medium: 2, low: 3, none: 4 };
          valA = p[valA || "none"] || 4;
          valB = p[valB || "none"] || 4;
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return { ...space, tasks };
  }, [space, filterAssignee, filterPriority, filterStatus, sortField, sortDirection]);

  const updateTask = async (t: Task) => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;

    const me = state.users.find((u) => u.id === state.currentUserId);

    try {
      const payload = { ...t, space_id: spaceId, userEmail: me?.email };
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

      if (space.emailReminders && me?.email) {
        toast.success(`Reminder queued`, {
          description: `Email will be sent to ${me.email} at ${space.emailDigestTime}`,
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
      <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-card/30 flex-shrink-0">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="sm:hidden" />
            <h1 className="text-sm font-semibold truncate flex items-center gap-2">
              <span>{space.emoji}</span>
              <span className="hidden sm:inline">{space.name}</span>
            </h1>
          </div>
          <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {views.map((v) => (
              <button
                key={v.id}
                onClick={() => setViewId(v.id)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  activeViewId === v.id
                    ? "text-primary bg-primary/10 ring-1 ring-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v.name}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => setChannelOpen((o) => !o)} className="px-2 sm:px-3">
            <MessageSquare className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Channel</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" title="Filter"><Filter className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filterStatus === "all"} onCheckedChange={() => setViewSetting("filterStatus", "all")}>All</DropdownMenuCheckboxItem>
              {space?.columns.map(c => (
                <DropdownMenuCheckboxItem key={c.id} checked={filterStatus === c.id} onCheckedChange={() => setViewSetting("filterStatus", c.id)}>{c.name}</DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              {["all", "high", "medium", "low", "none"].map(p => (
                <DropdownMenuCheckboxItem key={p} checked={filterPriority === p} onCheckedChange={() => setViewSetting("filterPriority", p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Assignee</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={filterAssignee === "all"} onCheckedChange={() => setViewSetting("filterAssignee", "all")}>All</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filterAssignee === state.currentUserId} onCheckedChange={() => setViewSetting("filterAssignee", state.currentUserId || "all")}>Me</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={filterAssignee === "unassigned"} onCheckedChange={() => setViewSetting("filterAssignee", "unassigned")}>Unassigned</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" title="Sort"><ArrowUpDown className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort Field</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={sortField === "default"} onCheckedChange={() => setViewSetting("sortField", "default")}>Default</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={sortField === "dueDate"} onCheckedChange={() => setViewSetting("sortField", "dueDate")}>Due Date</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={sortField === "priority"} onCheckedChange={() => setViewSetting("sortField", "priority")}>Priority</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={sortField === "title"} onCheckedChange={() => setViewSetting("sortField", "title")}>Title</DropdownMenuCheckboxItem>
              {space?.customFields.map(f => (
                <DropdownMenuCheckboxItem key={f.id} checked={sortField === f.id} onCheckedChange={() => setViewSetting("sortField", f.id)}>{f.name}</DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Direction</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={sortDirection === "asc"} onCheckedChange={() => setViewSetting("sortDirection", "asc")}>Ascending</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={sortDirection === "desc"} onCheckedChange={() => setViewSetting("sortDirection", "desc")}>Descending</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3" title="View Options"><SlidersHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
              {[
                { id: "status", label: "Status" },
                { id: "assignee", label: "Assignee" },
                { id: "priority", label: "Priority" },
                { id: "dueDate", label: "Due Date" },
                ...(space?.customFields || []).map(f => ({ id: f.id, label: f.name }))
              ].map(f => {
                const isHidden = activeView?.settings?.hiddenFields?.[f.id] === true;
                return (
                  <DropdownMenuCheckboxItem
                    key={f.id}
                    checked={!isHidden}
                    onCheckedChange={async (c) => {
                      if (!space || !activeViewId) return;
                      const newViews = space.views.map(v => v.id === activeViewId ? {
                        ...v,
                        settings: {
                          ...(v.settings || {}),
                          hiddenFields: {
                            ...(v.settings?.hiddenFields || {}),
                            [f.id]: !c
                          }
                        }
                      } : v);

                      const updatedSpace = { ...space, views: newViews };

                      update(s => ({
                        ...s,
                        spaces: s.spaces.map(sp => sp.id === space.id ? updatedSpace : sp)
                      }));
                      const token = localStorage.getItem("syncduo_token");
                      if (token) {
                        try {
                          await fetch(`/api/spaces/${space.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                            body: JSON.stringify(updatedSpace)
                          });
                        } catch (e) {
                          toast.error("Failed to sync view settings");
                        }
                      }
                    }}
                  >
                    {f.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Space Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import Tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportTasksToExcel(space, space.tasks, state.users)}>
                <Download className="mr-2 h-4 w-4" />
                Export Tasks
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            onClick={() => { setOpenTask(newTask()); setCreating(true); }}
            className="px-2 sm:px-3"
          >
            <Plus className="size-3.5 sm:mr-1" />
            <span className="hidden sm:inline">New Task</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden flex-col sm:flex-row">
        <div className="flex-1 overflow-auto">
          {activeViewType === "list" && <ListView space={processedSpace!} viewId={activeViewId} onOpen={(t) => { setOpenTask(t); setCreating(false); }} onMove={updateTask} />}
          {activeViewType === "kanban" && <KanbanView space={processedSpace!} viewId={activeViewId} onOpen={(t) => { setOpenTask(t); setCreating(false); }} onMove={updateTask} />}
          {activeViewType === "calendar" && <CalendarView space={processedSpace!} viewId={activeViewId} onOpen={(t) => { setOpenTask(t); setCreating(false); }} onMove={updateTask} />}
          {activeViewType === "gantt" && <GanttView space={processedSpace!} onOpen={(t) => { setOpenTask(t); setCreating(false); }} onUpdate={updateTask} />}
          {activeViewType === "table" && <TableView space={processedSpace!} viewId={activeViewId} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
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
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        space={space}
      />
    </>
  );
}
