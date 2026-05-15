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

          <Section title="View Settings" subtitle="Settings for every view in JSON format.">
            <div>
              <Textarea
                className="font-mono text-xs w-full h-32"
                placeholder='{"table": {"showDescription": true}}'
                value={localSpace.settings || ""}
                onChange={(e) => patchLocal((sp) => ({ ...sp, settings: e.target.value }))}
              />
            </div>
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
                <p className="text-xs text-muted-foreground">Sent to {state.notificationsEmail}</p>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Test reminder queued", { description: `→ ${state.notificationsEmail}` })}
            >
              Send test reminder
            </Button>
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
