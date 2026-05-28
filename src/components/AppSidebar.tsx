import { useState, useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Settings, Plus, MessageSquare, Trash2 } from "lucide-react";
import { useStore, uid, type CustomField, type FieldType } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GlobalAutomationsDialog } from "./GlobalAutomationsDialog";
import { ApiKeysDialog } from "./ApiKeysDialog";
import { Key } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function AppSidebar() {
  const { state, update } = useStore();
  const path = useRouterState({ select: (r) => r.location.pathname });

  // ⚡ Bolt: Memoize me and others calculations to prevent O(N) array traversals
  // on every route change or unrelated state update
  const me = useMemo(() => state.users.find((u) => u.id === state.currentUserId), [state.users, state.currentUserId]);
  const others = useMemo(() => state.users.filter((u) => me && u.id !== me.id), [state.users, me]);

  const [isSpaceDialogOpen, setIsSpaceDialogOpen] = useState(false);
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false);
  const [isApiKeysOpen, setIsApiKeysOpen] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [columns, setColumns] = useState<string[]>(["description", "priority", "assignee", "startDate", "dueDate"]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const resetForm = () => {
    setNewSpaceName("");
    setColumns(["description", "priority", "assignee", "startDate", "dueDate"]);
    setCustomFields([]);
  };

  const handleAddSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    
    const token = localStorage.getItem("syncduo_token");
    if (!token) {
      return;
    }

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newSpaceName.trim(),
          columns,
          customFields,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create space");
      }

      const data = await res.json() as any;

      update((s) => ({
        ...s,
        spaces: [
          ...s.spaces,
          {
            id: data.id,
            name: newSpaceName.trim(),
            emoji: "✨",
            views: [
              { id: "list", name: "List", type: "list" },
              { id: "kanban", name: "Kanban", type: "kanban" },
              { id: "calendar", name: "Calendar", type: "calendar" },
              { id: "gantt", name: "Gantt", type: "gantt" },
              { id: "table", name: "Table", type: "table" },
            ],
            columns,
            customFields,
            emailReminders: false,
            emailDigestTime: "09:00",
            tasks: [],
            channel: [],
          },
        ],
      }));

      resetForm();
      setIsSpaceDialogOpen(false);
    } catch (err) {
      // Ignore error to prevent logging in production
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={isSpaceDialogOpen} onOpenChange={(open) => {
        setIsSpaceDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Space</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSpace} className="space-y-4 py-4">
            <div>
              <Label className="text-xs">Space Name</Label>
              <Input
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Space name"
                autoFocus
              />
            </div>

            <ScrollArea className="max-h-[50vh] pr-4 space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-semibold">Active Fields</Label>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  {[
                    { id: "description", name: "Description" },
                    { id: "priority", name: "Priority" },
                    { id: "assignee", name: "Assignee" },
                    { id: "startDate", name: "Start Date" },
                    { id: "dueDate", name: "Due Date" },
                  ].map((f) => (
                    <div key={f.id} className="flex items-center justify-between space-x-2">
                      <Label htmlFor={`field-${f.id}`} className="text-xs font-medium cursor-pointer">{f.name}</Label>
                      <Switch
                        id={`field-${f.id}`}
                        checked={columns.includes(f.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setColumns([...columns, f.id]);
                          } else {
                            setColumns(columns.filter((x) => x !== f.id));
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 mt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Custom Fields</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCustomFields([...customFields, { id: uid(), name: "", type: "text" }])}>
                    <Plus className="size-3.5 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {customFields.map((f, i) => (
                    <div key={f.id} className="flex gap-2 items-start">
                       <Input
                        className="flex-1"
                        value={f.name}
                        placeholder="Field name"
                        onChange={(e) => setCustomFields(customFields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      />
                      <Select
                        value={f.type}
                        onValueChange={(v) => setCustomFields(customFields.map((x, j) => (j === i ? { ...x, type: v as FieldType } : x)))}
                      >
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="select">Select</SelectItem>
                        </SelectContent>
                      </Select>
                      {f.type === "select" && (
                        <Input
                          className="w-32"
                          placeholder="Options (comma-separated)"
                          value={(f.options ?? []).join(",")}
                          onChange={(e) =>
                            setCustomFields(customFields.map((x, j) =>
                              j === i ? { ...x, options: e.target.value.split(",") } : x
                            ))
                          }
                        />
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" aria-label="Delete field" onClick={() => setCustomFields(customFields.filter((_, j) => j !== i))}>
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete field</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsSpaceDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!newSpaceName.trim()}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sidebar className="border-r border-border bg-sidebar">
        <SidebarHeader className="p-4 flex flex-row items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center">
              <div className="size-2.5 rounded-full bg-primary" />
            </div>
            <span className="font-semibold tracking-tight">Sync Duo</span>
          </div>
          <SidebarTrigger className="md:hidden" />
        </SidebarHeader>

        <SidebarContent className="px-3 space-y-6 pt-2">
          <div>
            <div className="px-2 mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Spaces</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setIsSpaceDialogOpen(true)} aria-label="Add space" className="text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <Plus className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add space</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="space-y-0.5">
              {state.spaces.map((sp) => {
                const active = path.startsWith(`/space/${sp.id}`);
                return (
                  <Link
                    key={sp.id}
                    to="/space/$spaceId"
                    params={{ spaceId: sp.id }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                      active ? "bg-accent text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <span className="text-xs">{sp.emoji}</span>
                    <span className="truncate">{sp.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Direct Messages</p>
            <div className="space-y-0.5">
              {others.map((u) => {
                const active = path === `/chat/${u.id}`;
                return (
                  <Link
                    key={u.id}
                    to="/chat/$userId"
                    params={{ userId: u.id }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                      active ? "bg-accent text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    <div className="size-5 rounded bg-muted ring-1 ring-border grid place-items-center text-[10px]">{u.initials}</div>
                    <span className="truncate">{u.name}</span>
                    <div className="ml-auto size-1.5 rounded-full bg-primary" />
                  </Link>
                );
              })}
            </div>
          </div>
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => setIsAutomationsOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Settings className="size-4" />
            <span>Automations</span>
          </button>
          <Link
            to="/settings"
            className={`w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              path === "/settings" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <Settings className="size-4" />
            <span>Settings</span>
          </Link>
          <button
            onClick={() => setIsApiKeysOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Key className="size-4" />
            <span>API Keys</span>
          </button>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="size-7 rounded-full bg-muted ring-1 ring-border grid place-items-center text-[11px] font-medium">{me?.initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{me?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{me?.email}</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <GlobalAutomationsDialog open={isAutomationsOpen} onOpenChange={setIsAutomationsOpen} />
      <ApiKeysDialog isOpen={isApiKeysOpen} onOpenChange={setIsApiKeysOpen} />
    </TooltipProvider>
  );
}
