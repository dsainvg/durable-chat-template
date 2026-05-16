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

  useEffect(() => {
    if (open && space) {
      setLocalSpace(space);
    }
  }, [open, space]);

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
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full flex mb-6">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              <TabsTrigger value="automations" className="flex-1">Automations</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-8 mt-0">
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
                  <Button variant="ghost" size="icon" onClick={() => patchLocal((sp) => ({ ...sp, columns: sp.columns.filter((_, j) => j !== i) }))}>
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

              <Section title="Danger zone">
                <Button variant="destructive" onClick={removeSpace}>Delete space</Button>
              </Section>
            </TabsContent>

            <TabsContent value="automations" className="space-y-8 mt-0">
              <Section title="Automations" subtitle="Set up automated actions based on triggers.">
                <div className="space-y-4">
                  {(localSpace.automations || []).map((auto, i) => (
                    <div key={auto.id} className="border border-border p-4 rounded-lg space-y-4 bg-card">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={auto.enabled}
                            onCheckedChange={(c) => patchLocal((sp) => ({
                              ...sp,
                              automations: sp.automations?.map((x, j) => j === i ? { ...x, enabled: c } : x)
                            }))}
                          />
                          <span className="text-sm font-medium">Automation {i + 1}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => patchLocal((sp) => ({
                          ...sp,
                          automations: sp.automations?.filter((_, j) => j !== i)
                        }))}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">When this happens...</Label>
                          <Select
                            value={auto.condition_type}
                            onValueChange={(v) => patchLocal((sp) => ({
                              ...sp,
                              automations: sp.automations?.map((x, j) => j === i ? { ...x, condition_type: v as any } : x)
                            }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Task is Unassigned</SelectItem>
                              <SelectItem value="assigned">Task is Assigned</SelectItem>
                              <SelectItem value="due_today">Task is Due Today</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Do this...</Label>
                          <Select
                            value={auto.action_type}
                            onValueChange={(v) => patchLocal((sp) => ({
                              ...sp,
                              automations: sp.automations?.map((x, j) => j === i ? { ...x, action_type: v as any } : x)
                            }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Select action" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="set_status">Set Status</SelectItem>
                              <SelectItem value="send_email">Send Email</SelectItem>
                              <SelectItem value="move_space">Move to Space</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {auto.action_type === "set_status" && (
                          <>
                            <Label className="text-xs">Target Status</Label>
                            <Select
                              value={auto.action_payload?.status || ""}
                              onValueChange={(v) => patchLocal((sp) => ({
                                ...sp,
                                automations: sp.automations?.map((x, j) => j === i ? { ...x, action_payload: { ...x.action_payload, status: v } } : x)
                              }))}
                            >
                              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                              <SelectContent>
                                {localSpace.columns.map(col => (
                                  <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}

                        {auto.action_type === "send_email" && (
                          <>
                            <Label className="text-xs">Target Email</Label>
                            <Input
                              placeholder="Email address"
                              value={auto.action_payload?.email || ""}
                              onChange={(e) => patchLocal((sp) => ({
                                ...sp,
                                automations: sp.automations?.map((x, j) => j === i ? { ...x, action_payload: { ...x.action_payload, email: e.target.value } } : x)
                              }))}
                            />
                          </>
                        )}

                        {auto.action_type === "move_space" && (
                          <>
                            <Label className="text-xs">Target Space ID</Label>
                            <Select
                              value={auto.action_payload?.space_id || ""}
                              onValueChange={(v) => patchLocal((sp) => ({
                                ...sp,
                                automations: sp.automations?.map((x, j) => j === i ? { ...x, action_payload: { ...x.action_payload, space_id: v } } : x)
                              }))}
                            >
                              <SelectTrigger><SelectValue placeholder="Select space" /></SelectTrigger>
                              <SelectContent>
                                {state.spaces.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => patchLocal((sp) => ({
                      ...sp,
                      automations: [
                        ...(sp.automations || []),
                        { id: uid(), enabled: true, condition_type: "unassigned", condition_payload: {}, action_type: "set_status", action_payload: {} }
                      ]
                    }))}
                  >
                    <Plus className="mr-2 size-4" /> Add Automation
                  </Button>
                </div>
              </Section>
            </TabsContent>
          </Tabs>

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
