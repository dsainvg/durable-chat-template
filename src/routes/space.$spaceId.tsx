import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useStore, uid, type Task, type ViewType, type Space } from "@/lib/store";
import usePartySocket from "partysocket/react";
import { Button } from "@/components/ui/button";
import { Settings, Plus, MessageSquare } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Filter, ArrowUpDown, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
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

  const views = useMemo(() => {
    if (space?.settings?.views) return space.settings.views as { id: string, type: ViewType, name: string }[];
    const enabled = VIEW_LABELS.filter((v) => space?.enabledViews[v.id]);
    if (enabled.length === 0) return [{ id: "list", type: "list" as ViewType, name: "List" }];
    return enabled.map(v => ({ id: v.id, type: v.id, name: v.label }));
  }, [space]);

  const [activeViewId, setActiveViewId] = useState<string>(views[0]?.id ?? "list");
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

  const activeViewObj = views.find(v => v.id === activeViewId) || views[0];
  const activeView = activeViewObj?.id;
  const activeViewType = activeViewObj?.type;

  const viewSettings = space.settings?.[activeView] || {};
  const sortField = viewSettings.sortField || "default";
  const sortDirection = viewSettings.sortDirection || "asc";
  const filterAssignee = viewSettings.filterAssignee || "all";
  const filterPriority = viewSettings.filterPriority || "all";
  const filterStatus = viewSettings.filterStatus || "all";

  const updateSpaceSettings = (key: string, value: any) => {
    let finalSpace: Space | undefined;
    update(s => {
      const sp = s.spaces.find(x => x.id === spaceId);
      if (!sp) return s;
      const newSettings = { ...sp.settings, [key]: value };
      finalSpace = { ...sp, settings: newSettings };
      return {
        ...s,
        spaces: s.spaces.map(x => x.id === spaceId ? finalSpace! : x)
      };
    });

    if (finalSpace) {
      const token = localStorage.getItem("syncduo_token");
      if (token) {
        fetch(`/api/spaces/${spaceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(finalSpace)
        }).catch(() => toast.error("Failed to sync settings"));
      }
    }
  };

  const setViewSetting = (key: string, value: any) => {
    let finalSpace: Space | undefined;
    update(s => {
      const sp = s.spaces.find(x => x.id === spaceId);
      if (!sp) return s;
      const newSettings = {
        ...sp.settings,
        [activeView]: {
          ...(sp.settings?.[activeView] || {}),
          [key]: value
        }
      };
      finalSpace = { ...sp, settings: newSettings };
      return {
        ...s,
        spaces: s.spaces.map(x => x.id === spaceId ? finalSpace! : x)
      };
    });

    if (finalSpace) {
      const token = localStorage.getItem("syncduo_token");
      if (token) {
        fetch(`/api/spaces/${spaceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(finalSpace)
        }).catch(() => toast.error("Failed to sync view settings"));
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
              <div key={v.id} className="flex items-center group relative">
                <button
                  onClick={() => setActiveViewId(v.id)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    activeView === v.id
                      ? "text-primary bg-primary/10 ring-1 ring-primary/20"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.name}
                </button>
                {activeView === v.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground bg-background rounded-full shadow-sm border border-border mr-0.5">
                        <ChevronDown className="size-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => {
                        const newName = prompt("Enter new name for view:", v.name);
                        if (newName && newName.trim()) {
                          const newViews = views.map(x => x.id === v.id ? { ...x, name: newName.trim() } : x);
                          updateSpaceSettings("views", newViews);
                        }
                      }}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const newId = `${v.type}-${uid()}`;
                        const newViews = [...views, { id: newId, type: v.type, name: `${v.name} Copy` }];
                        const currentSettings = space.settings?.[v.id] || {};

                        const newSettings = {
                          ...space.settings,
                          views: newViews,
                          [newId]: { ...currentSettings }
                        };

                        update(s => ({
                          ...s,
                          spaces: s.spaces.map(sp => sp.id === spaceId ? { ...sp, settings: newSettings } : sp)
                        }));

                        const token = localStorage.getItem("syncduo_token");
                        if (token) {
                          fetch(`/api/spaces/${spaceId}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                            body: JSON.stringify({ ...space, settings: newSettings })
                          }).catch(() => toast.error("Failed to sync view duplicate"));
                        }

                        setActiveViewId(newId);
                      }}>Duplicate</DropdownMenuItem>
                      {views.length > 1 && (
                        <DropdownMenuItem onClick={() => {
                          if (confirm(`Delete view "${v.name}"?`)) {
                            const newViews = views.filter(x => x.id !== v.id);
                            updateSpaceSettings("views", newViews);
                            if (activeViewId === v.id) setActiveViewId(newViews[0].id);
                          }
                        }} className="text-destructive">Delete</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
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
            <DropdownMenuContent align="end" className="w-64 max-h-[80vh] overflow-y-auto">
              <DropdownMenuLabel>Fields</DropdownMenuLabel>
              {(() => {
                const allFields = [
                  { id: "status", label: "Status" },
                  { id: "assignee", label: "Assignee" },
                  { id: "priority", label: "Priority" },
                  { id: "dueDate", label: "Due Date" },
                  ...(space?.customFields || []).map(f => ({ id: f.id, label: f.name }))
                ];
                const order = space?.settings?.[activeView]?.fieldOrder || allFields.map(f => f.id);
                const sortedFields = [...allFields].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

                return sortedFields.map((f, i) => {
                  const isHidden = space?.settings?.[activeView]?.hiddenFields?.[f.id] === true;
                  return (
                    <div key={f.id} className="flex items-center px-2 py-1.5 text-sm hover:bg-accent rounded-sm">
                      <DropdownMenuCheckboxItem
                        checked={!isHidden}
                        onCheckedChange={async (c) => {
                          if (!space) return;
                          let finalSpace: Space | undefined;
                          update(s => {
                            const sp = s.spaces.find(x => x.id === spaceId);
                            if (!sp) return s;
                            const newSettings = {
                              ...sp.settings,
                              [activeView]: {
                                ...(sp.settings?.[activeView] || {}),
                                hiddenFields: {
                                  ...(sp.settings?.[activeView]?.hiddenFields || {}),
                                  [f.id]: !c
                                }
                              }
                            };
                            finalSpace = { ...sp, settings: newSettings };
                            return {
                              ...s,
                              spaces: s.spaces.map(x => x.id === spaceId ? finalSpace! : x)
                            };
                          });
                          if (finalSpace) {
                            const token = localStorage.getItem("syncduo_token");
                            if (token) fetch(`/api/spaces/${spaceId}`, { method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(finalSpace) }).catch(() => toast.error("Failed to sync view settings"));
                          }
                        }}
                        className="flex-1 min-w-0"
                        onSelect={(e) => e.preventDefault()}
                      >
                        {f.label}
                      </DropdownMenuCheckboxItem>
                      <div className="flex gap-0.5 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 h-5 w-5 disabled:opacity-50"
                          disabled={i === 0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (i === 0) return;
                            const newOrder = [...order];
                            [newOrder[i - 1], newOrder[i]] = [newOrder[i], newOrder[i - 1]];
                            setViewSetting("fieldOrder", newOrder);
                          }}
                        >
                          <ChevronUp className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 h-5 w-5 disabled:opacity-50"
                          disabled={i === sortedFields.length - 1}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (i === sortedFields.length - 1) return;
                            const newOrder = [...order];
                            [newOrder[i + 1], newOrder[i]] = [newOrder[i], newOrder[i + 1]];
                            setViewSetting("fieldOrder", newOrder);
                          }}
                        >
                          <ChevronDown className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                });
              })()}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="px-2 sm:px-3"
          >
            <Settings className="size-4" />
          </Button>
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
          {activeViewType === "list" && <ListView space={processedSpace!} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
          {activeViewType === "kanban" && <KanbanView space={processedSpace!} onOpen={(t) => { setOpenTask(t); setCreating(false); }} onMove={updateTask} />}
          {activeViewType === "calendar" && <CalendarView space={processedSpace!} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
          {activeViewType === "gantt" && <GanttView space={processedSpace!} onOpen={(t) => { setOpenTask(t); setCreating(false); }} onUpdate={updateTask} />}
          {activeViewType === "table" && <TableView space={processedSpace!} onOpen={(t) => { setOpenTask(t); setCreating(false); }} />}
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
