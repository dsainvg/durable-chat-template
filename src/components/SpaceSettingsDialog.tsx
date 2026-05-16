import { useState, useEffect } from "react";
import { useStore, uid, type FieldType, type ViewType } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

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

  useEffect(() => {
    if (open && space) {
      setLocalSpace(space);
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
            color: localSpace.color,
            emoji: localSpace.emoji,
            enabledViews: localSpace.enabledViews,
            columns: localSpace.columns,
            customFields: localSpace.customFields,
            emailReminders: localSpace.emailReminders,
            emailDigestTime: localSpace.emailDigestTime,
            settings: localSpace.settings,
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

  const removeSpace = () => {
    if (!confirm(`Delete "${localSpace.name}"?`)) return;
    update((s) => ({ ...s, spaces: s.spaces.filter((sp) => sp.id !== spaceId) }));
    onOpenChange(false);
    navigate({ to: "/" });
  };

  return (
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

          <Section title="Views" subtitle="Toggle which views are available in this space.">
            <div className="grid grid-cols-2 gap-3">
              {VIEWS.map((v) => (
                <label key={v.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3 cursor-pointer">
                  <span className="text-sm">{v.label}</span>
                  <Switch
                    checked={localSpace.enabledViews[v.id]}
                    onCheckedChange={(c) =>
                      patchLocal((sp) => ({ ...sp, enabledViews: { ...sp.enabledViews, [v.id]: c } }))
                    }
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section title="View Settings" subtitle="Configure preferences for specific views.">
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="w-full flex">
                <TabsTrigger value="list" className="flex-1">List</TabsTrigger>
                <TabsTrigger value="kanban" className="flex-1">Kanban</TabsTrigger>
                <TabsTrigger value="calendar" className="flex-1">Calendar</TabsTrigger>
                <TabsTrigger value="table" className="flex-1">Table</TabsTrigger>
              </TabsList>

              {["list", "kanban", "calendar", "table"].map(viewKey => (
                <TabsContent key={viewKey} value={viewKey} className="space-y-4 mt-4">
                  {(viewKey === "kanban" || viewKey === "list") && (
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <h3 className="text-sm font-medium">Group By</h3>
                      <Select
                        value={localSpace.settings?.[viewKey]?.groupBy || "status"}
                        onValueChange={(v) =>
                          patchLocal((sp) => ({
                            ...sp,
                            settings: {
                              ...sp.settings,
                              [viewKey]: {
                                ...(sp.settings?.[viewKey] || {}),
                                groupBy: v
                              }
                            }
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
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "status", label: "Status" },
                        { id: "assignee", label: "Assignee" },
                        { id: "priority", label: "Priority" },
                        { id: "dueDate", label: "Due Date" },
                        ...(localSpace.customFields || []).map(f => ({ id: f.id, label: f.name }))
                      ].map((field) => (
                        <label key={field.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Switch
                            checked={localSpace.settings?.[viewKey]?.hiddenFields?.[field.id] !== true}
                            onCheckedChange={(c) =>
                              patchLocal((sp) => ({
                                ...sp,
                                settings: {
                                  ...sp.settings,
                                  [viewKey]: {
                                    ...(sp.settings?.[viewKey] || {}),
                                    hiddenFields: {
                                      ...(sp.settings?.[viewKey]?.hiddenFields || {}),
                                      [field.id]: !c
                                    }
                                  }
                                }
                              }))
                            }
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </Section>

          <Section title="Columns" subtitle="Columns shown in Kanban / List.">
            <div className="space-y-2">
              {localSpace.columns.map((c, i) => (
                <div key={c.id} className="flex gap-2">
                  <Input
                    value={c.name}
                    onChange={(e) =>
                      patchLocal((sp) => ({
                        ...sp,
                        columns: sp.columns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                      }))
                    }
                  />
                  <Button variant="ghost" size="icon" aria-label="Delete column" onClick={() => patchLocal((sp) => ({ ...sp, columns: sp.columns.filter((_, j) => j !== i) }))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => patchLocal((sp) => ({ ...sp, columns: [...sp.columns, { id: uid(), name: "New Column" }] }))}>
                <Plus className="size-3.5 mr-1" /> Add Column
              </Button>
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

          <Section title="Danger zone">
            <Button variant="destructive" onClick={removeSpace}>Delete space</Button>
          </Section>

          <div className="flex justify-end pt-4 border-t border-border mt-8">
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
