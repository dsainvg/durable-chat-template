import { useState, useEffect } from "react";
import { useStore, uid, type FieldType, type ViewType } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Plus, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { ExcelImportDialog, exportToExcel } from "./ExcelIntegration";

const VIEWS: { id: ViewType; label: string }[] = [
  { id: "list", label: "List" },
  { id: "kanban", label: "Kanban" },
  { id: "calendar", label: "Calendar" },
  { id: "gantt", label: "Gantt" },
  { id: "table", label: "Table" },
];

export function SpaceSettingsDialog({
  spaceId,
  open,
  onOpenChange,
}: {
  spaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, update } = useStore();
  const navigate = useNavigate();
  const space = state.spaces.find((s) => s.id === spaceId);
  const me = state.users.find((u) => u.id === state.currentUserId);

  const [localSpace, setLocalSpace] = useState(space);
  const [automations, setAutomations] = useState<import("@/lib/store").Automation[]>([]);
  const [newAutoTrigger, setNewAutoTrigger] = useState("due_today_with_assignee");
  const [newAutoAction, setNewAutoAction] = useState("send_email");
  const [newAutoConfig, setNewAutoConfig] = useState<Record<string, any>>({ email: me?.email || "" });
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (open && space) {
      const normalizedColumns = Array.isArray(space.columns) && (space.columns.length === 0 || typeof space.columns[0] === 'string')
        ? space.columns as any as string[]
        : ["description", "priority", "assignee", "startDate", "dueDate"];

      setLocalSpace({
        ...space,
        columns: normalizedColumns as any,
      });
      // Fetch automations
      const token = localStorage.getItem("syncduo_token");
      if (token) {
        fetch(`/api/spaces/${spaceId}/automations`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setAutomations(data);
          })
          .catch(console.error);
      }
    }
  }, [open, space]);

  const handleAddAutomation = async () => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/spaces/${spaceId}/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          trigger_type: newAutoTrigger,
          action_type: newAutoAction,
          config: newAutoConfig
        })
      });
      if (res.ok) {
        const data = await res.json() as import("@/lib/store").Automation;
        setAutomations([...automations, data]);
        toast.success("Automation added");
      } else {
        toast.error("Failed to add automation");
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleDeleteAutomation = async (autoId: string) => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/spaces/${spaceId}/automations/${autoId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setAutomations(automations.filter(a => a.id !== autoId));
        toast.success("Automation removed");
      }
    } catch (e) {
      toast.error("Failed to remove automation");
    }
  };

  if (!space || !localSpace) return null;

  const patchLocal = (fn: (sp: import("@/lib/store").Space) => import("@/lib/store").Space) => {
    setLocalSpace((prev) => (prev ? fn(prev) : prev));
  };

  const handleSave = async () => {
    if (!localSpace) return;

    update((s) => ({ ...s, spaces: s.spaces.map((sp) => (sp.id === spaceId ? localSpace : sp)) }));

    const token = localStorage.getItem("syncduo_token");
    if (token) {
      try {
        await fetch(`/api/spaces/${spaceId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            name: localSpace.name,
            emoji: localSpace.emoji,
            views: localSpace.views,
            columns: localSpace.columns,
            customFields: localSpace.customFields,
            emailReminders: localSpace.emailReminders,
            emailDigestTime: localSpace.emailDigestTime,
          })
        });
        toast.success("Settings saved");
      } catch (e) {
        console.error("Failed to sync space settings to server", e);
        toast.error("Failed to save settings");
      }
    }
    onOpenChange(false);
  };

  const removeSpace = async () => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;

    try {
      const response = await fetch(`/api/spaces/${spaceId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        // The websocket space_deleted broadcast will handle store update and navigation
        onOpenChange(false);
        toast.success("Space deleted");
      } else {
        const err = await response.json() as any;
        toast.error(err.error || "Failed to delete space");
      }
    } catch (e) {
      toast.error("An error occurred");
    }
  };

  const handleImport = async (tasks: import("@/lib/store").Task[], newFields?: { id: string; name: string; type: any }[]) => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;

    let updatedSpace = { ...localSpace };
    if (newFields && newFields.length > 0) {
      updatedSpace = {
        ...updatedSpace,
        customFields: [...updatedSpace.customFields, ...newFields.map(f => ({ id: f.id, name: f.name, type: f.type as import("@/lib/store").FieldType }))]
      };

      // Save updated space with new fields first
      try {
        await fetch(`/api/spaces/${spaceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(updatedSpace)
        });
      } catch (e) {
        console.error("Failed to update space fields", e);
      }
    }

    try {
      const res = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ space_id: spaceId, tasks })
      });

      if (res.ok) {
        // Optimistically update frontend store
        update(s => ({
          ...s,
          spaces: s.spaces.map(sp => sp.id === spaceId ? { ...updatedSpace, tasks: [...sp.tasks, ...tasks] } : sp)
        }));
        setLocalSpace(updatedSpace);
      } else {
        throw new Error("Bulk import failed");
      }
    } catch (e) {
      toast.error("Failed to import tasks");
      throw e;
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{localSpace.emoji} {localSpace.name} — Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-4">
          <Section title="General">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div>
                <Label className="text-xs">Emoji</Label>
                <Input value={localSpace.emoji} onChange={(e) => patchLocal((sp) => ({ ...sp, emoji: e.target.value }))} maxLength={2} />
              </div>
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={localSpace.name} onChange={(e) => patchLocal((sp) => ({ ...sp, name: e.target.value }))} />
              </div>
            </div>
          </Section>

          <Section title="Views" subtitle="Manage and customize your views.">
            <div className="space-y-2">
              {localSpace.views?.map((v) => (
                <div key={v.id} className="flex items-center gap-2 bg-card border border-border rounded-lg p-2">
                  <Input
                    className="flex-1 h-8"
                    value={v.name}
                    onChange={(e) =>
                      patchLocal((sp) => ({
                        ...sp,
                        views: sp.views.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x)),
                      }))
                    }
                  />
                  <div className="text-xs text-muted-foreground w-16">{v.type}</div>
                  <Button variant="ghost" size="icon" aria-label="Delete view" onClick={() => patchLocal((sp) => ({ ...sp, views: sp.views.filter(x => x.id !== v.id) }))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 items-center">
                <Select
                  onValueChange={(vStr) => {
                    const type = vStr as ViewType;
                    patchLocal((sp) => ({
                      ...sp,
                      views: [...(sp.views || []), { id: uid(), name: `New ${type}`, type }]
                    }));
                  }}
                >
                  <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Add view" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="list">List</SelectItem>
                    <SelectItem value="kanban">Kanban</SelectItem>
                    <SelectItem value="calendar">Calendar</SelectItem>
                    <SelectItem value="gantt">Gantt</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <Section title="View Settings" subtitle="Configure preferences for specific views.">
            {localSpace.views?.length === 0 && <p className="text-sm text-muted-foreground">No views available.</p>}
            {localSpace.views?.length > 0 && (
            <Tabs defaultValue={localSpace.views[0]?.id} className="w-full">
              <TabsList className="w-full flex overflow-x-auto no-scrollbar">
                {localSpace.views.map(v => (
                  <TabsTrigger key={v.id} value={v.id} className="flex-shrink-0 px-3">{v.name}</TabsTrigger>
                ))}
              </TabsList>

              {localSpace.views.map(viewObj => (
                <TabsContent key={viewObj.id} value={viewObj.id} className="space-y-4 mt-4">
                  {(viewObj.type === "kanban" || viewObj.type === "list") && (
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <h3 className="text-sm font-medium">Group By</h3>
                      <Select
                        value={viewObj.settings?.groupBy || "status"}
                        onValueChange={(val) =>
                          patchLocal((sp) => ({
                            ...sp,
                            views: sp.views.map(v => v.id === viewObj.id ? {
                              ...v,
                              settings: {
                                ...(v.settings || {}),
                                groupBy: val
                              }
                            } : v)
                          }))
                        }
                      >
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="assignee">Assignee</SelectItem>
                          <SelectItem value="priority">Priority</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-medium">Visible Fields</h3>
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const allFields = [
                          { id: "status", label: "Status" },
                          { id: "assignee", label: "Assignee" },
                          { id: "priority", label: "Priority" },
                          { id: "dueDate", label: "Due Date" },
                          ...(localSpace.customFields || []).map(f => ({ id: f.id, label: f.name }))
                        ];
                        const fieldOrder = viewObj.settings?.fieldOrder || allFields.map(f => f.id);
                        const allFieldsMap = new Map(allFields.map(f => [f.id, f]));
                        const fieldOrderSet = new Set(fieldOrder);
                        const orderedFields = fieldOrder.map((id: string) => allFieldsMap.get(id)).filter(Boolean);
                        const remainingFields = allFields.filter(f => !fieldOrderSet.has(f.id));
                        const finalFields = [...orderedFields, ...remainingFields];

                        return finalFields.map((field: any, idx: number) => (
                          <div key={field.id} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <Switch
                                checked={viewObj.settings?.hiddenFields?.[field.id] !== true}
                                onCheckedChange={(c) =>
                                  patchLocal((sp) => ({
                                    ...sp,
                                    views: sp.views.map(v => v.id === viewObj.id ? {
                                      ...v,
                                      settings: {
                                        ...(v.settings || {}),
                                        hiddenFields: {
                                          ...(v.settings?.hiddenFields || {}),
                                          [field.id]: !c
                                        }
                                      }
                                    } : v)
                                  }))
                                }
                              />
                              {field.label}
                            </label>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                aria-label="Move field up"
                                disabled={idx === 0}
                                onClick={() => {
                                  const newOrder = [...fieldOrder];
                                  if (!newOrder.includes(field.id)) {
                                    newOrder.push(...remainingFields.map(f => f.id));
                                  }
                                  const currentIdx = newOrder.indexOf(field.id);
                                  [newOrder[currentIdx - 1], newOrder[currentIdx]] = [newOrder[currentIdx], newOrder[currentIdx - 1]];
                                  patchLocal((sp) => ({
                                    ...sp,
                                    views: sp.views.map(v => v.id === viewObj.id ? {
                                      ...v,
                                      settings: {
                                        ...(v.settings || {}),
                                        fieldOrder: newOrder
                                      }
                                    } : v)
                                  }));
                                }}
                              >
                                ↑
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                aria-label="Move field down"
                                disabled={idx === finalFields.length - 1}
                                onClick={() => {
                                  const newOrder = [...fieldOrder];
                                  if (!newOrder.includes(field.id)) {
                                    newOrder.push(...remainingFields.map(f => f.id));
                                  }
                                  const currentIdx = newOrder.indexOf(field.id);
                                  [newOrder[currentIdx], newOrder[currentIdx + 1]] = [newOrder[currentIdx + 1], newOrder[currentIdx]];
                                  patchLocal((sp) => ({
                                    ...sp,
                                    views: sp.views.map(v => v.id === viewObj.id ? {
                                      ...v,
                                      settings: {
                                        ...(v.settings || {}),
                                        fieldOrder: newOrder
                                      }
                                    } : v)
                                  }));
                                }}
                              >
                                ↓
                              </Button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            )}
          </Section>

          <Section title="Active Fields" subtitle="Toggle standard fields enabled in this space.">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
              {[
                { id: "description", name: "Description" },
                { id: "priority", name: "Priority" },
                { id: "assignee", name: "Assignee" },
                { id: "startDate", name: "Start Date" },
                { id: "dueDate", name: "Due Date" },
              ].map((f) => (
                <div key={f.id} className="flex items-center justify-between space-x-2">
                  <Label htmlFor={`edit-field-${f.id}`} className="text-xs font-medium cursor-pointer">{f.name}</Label>
                  <Switch
                    id={`edit-field-${f.id}`}
                    checked={(localSpace.columns as any as string[]).includes(f.id)}
                    onCheckedChange={(checked) => {
                      patchLocal((sp) => {
                        const currentCols = Array.isArray(sp.columns) ? (sp.columns as any as string[]) : [];
                        const newCols = checked
                          ? [...currentCols.filter((x: string) => typeof x === 'string'), f.id]
                          : currentCols.filter((x: string) => typeof x === 'string' && x !== f.id);
                        return { ...sp, columns: newCols as any };
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Custom task fields" subtitle="Extra fields displayed when editing tasks.">
            <div className="space-y-2">
              {localSpace.customFields.map((f, i) => (
                <div key={f.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      className="w-full"
                      value={f.name}
                      placeholder="Field name"
                      onChange={(e) =>
                        patchLocal((sp) => ({
                          ...sp,
                          customFields: sp.customFields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                        }))
                      }
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Switch
                        className="scale-75 origin-left"
                        checked={f.required ?? false}
                        onCheckedChange={(c) =>
                          patchLocal((sp) => ({
                            ...sp,
                            customFields: sp.customFields.map((x, j) => (j === i ? { ...x, required: c } : x)),
                          }))
                        }
                      />
                      Required
                    </label>
                  </div>
                  <Select
                    value={f.type}
                    onValueChange={(v) =>
                      patchLocal((sp) => ({
                        ...sp,
                        customFields: sp.customFields.map((x, j) => (j === i ? { ...x, type: v as FieldType } : x)),
                      }))
                    }
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                  {f.type === "select" && (
                    <Input
                      className="w-48"
                      placeholder="Options (comma-separated)"
                      value={(f.options ?? []).join(",")}
                      onChange={(e) =>
                        patchLocal((sp) => ({
                          ...sp,
                          customFields: sp.customFields.map((x, j) =>
                            j === i ? { ...x, options: e.target.value.split(",") } : x
                          ),
                        }))
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => patchLocal((sp) => ({ ...sp, customFields: sp.customFields.filter((_, j) => j !== i) }))}
                    aria-label="Delete field"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  patchLocal((sp) => ({
                    ...sp,
                    customFields: [...sp.customFields, { id: uid(), name: "", type: "text", required: false }],
                  }))
                }
              >
                <Plus className="size-3.5 mr-1" /> Add Custom Field
              </Button>
            </div>
          </Section>

          <Section title="Email reminders" subtitle="Reminders for due tasks are mailed (no backend needed in this prototype).">
            <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
              <div>
                <p className="text-sm">Daily digest</p>
                <p className="text-xs text-muted-foreground">Sent to {me?.email}</p>
              </div>
              <Switch
                checked={localSpace.emailReminders}
                onCheckedChange={(c) => patchLocal((sp) => ({ ...sp, emailReminders: c }))}
              />
            </div>
            <div>
              <Label className="text-xs">Digest time</Label>
              <Input
                type="time"
                value={localSpace.emailDigestTime}
                onChange={(e) => patchLocal((sp) => ({ ...sp, emailDigestTime: e.target.value }))}
                className="w-40"
              />
            </div>
          </Section>

          <Section title="Automations" subtitle="Global Automations have moved.">
            <p className="text-sm text-muted-foreground">Automations are now managed globally. Please access Automations from the sidebar.</p>
          </Section>

          <Section title="Data Management" subtitle="Export or import space data.">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToExcel(space.tasks, space, state.users)}>
                <Download className="size-3.5 mr-2" /> Export to Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="size-3.5 mr-2" /> Import from Excel
              </Button>
            </div>
          </Section>

          <Section title="Danger zone">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete space</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the space "{localSpace.name}" and all of its tasks. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={removeSpace} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Space</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Section>

          <div className="flex justify-end pt-4 border-t border-border mt-8">
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <ExcelImportDialog
      open={importOpen}
      onOpenChange={setImportOpen}
      space={localSpace}
      users={state.users}
      onImport={handleImport}
    />
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
