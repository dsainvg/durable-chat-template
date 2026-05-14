import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore, uid, type FieldType, type ViewType } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/space/$spaceId/settings")({
  component: SpaceSettings,
});

const VIEWS: { id: ViewType; label: string }[] = [
  { id: "list", label: "List" },
  { id: "kanban", label: "Kanban" },
  { id: "calendar", label: "Calendar" },
  { id: "gantt", label: "Gantt" },
];

function SpaceSettings() {
  const { spaceId } = Route.useParams();
  const { state, update } = useStore();
  const navigate = useNavigate();
  const space = state.spaces.find((s) => s.id === spaceId);
  if (!space) return <div className="p-8">Not found.</div>;

  const patch = async (fn: (sp: import("@/lib/store").Space) => import("@/lib/store").Space) => {
    const updatedSpace = fn(space);
    update((s) => ({ ...s, spaces: s.spaces.map((sp) => (sp.id === spaceId ? updatedSpace : sp)) }));

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
            name: updatedSpace.name,
            color: updatedSpace.color,
            emoji: updatedSpace.emoji,
            enabledViews: updatedSpace.enabledViews,
            columns: updatedSpace.columns,
            customFields: updatedSpace.customFields,
            emailReminders: updatedSpace.emailReminders,
            emailDigestTime: updatedSpace.emailDigestTime,
          })
        });
      } catch (e) {
        console.error("Failed to sync space settings to server", e);
      }
    }
  };

  const removeSpace = () => {
    if (!confirm(`Delete "${space.name}"?`)) return;
    update((s) => ({ ...s, spaces: s.spaces.filter((sp) => sp.id !== spaceId) }));
    navigate({ to: "/" });
  };

  return (
    <div className="flex-1 overflow-auto">
      <header className="h-14 px-6 flex items-center gap-3 border-b border-border bg-card/30">
        <Link to="/space/$spaceId" params={{ spaceId }} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-sm font-semibold">{space.emoji} {space.name} — Settings</h1>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <Section title="General">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <Label className="text-xs">Emoji</Label>
              <Input value={space.emoji} onChange={(e) => patch((sp) => ({ ...sp, emoji: e.target.value }))} maxLength={2} />
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={space.name} onChange={(e) => patch((sp) => ({ ...sp, name: e.target.value }))} />
            </div>
          </div>
        </Section>

        <Section title="Views" subtitle="Toggle which views are available in this space.">
          <div className="grid grid-cols-2 gap-3">
            {VIEWS.map((v) => (
              <label key={v.id} className="flex items-center justify-between bg-card border border-border rounded-lg p-3 cursor-pointer">
                <span className="text-sm">{v.label}</span>
                <Switch
                  checked={space.enabledViews[v.id]}
                  onCheckedChange={(c) =>
                    patch((sp) => ({ ...sp, enabledViews: { ...sp.enabledViews, [v.id]: c } }))
                  }
                />
              </label>
            ))}
          </div>
        </Section>

        <Section title="Columns" subtitle="Columns shown in Kanban / List.">
          <div className="space-y-2">
            {space.columns.map((c, i) => (
              <div key={c.id} className="flex gap-2">
                <Input
                  value={c.name}
                  onChange={(e) =>
                    patch((sp) => ({
                      ...sp,
                      columns: sp.columns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    }))
                  }
                />
                <Button variant="ghost" size="icon" onClick={() => patch((sp) => ({ ...sp, columns: sp.columns.filter((_, j) => j !== i) }))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => patch((sp) => ({ ...sp, columns: [...sp.columns, { id: uid(), name: "New Column" }] }))}>
              <Plus className="size-3.5 mr-1" /> Add Column
            </Button>
          </div>
        </Section>

        <Section title="Custom task fields" subtitle="Extra fields displayed when editing tasks.">
          <div className="space-y-2">
            {space.customFields.map((f, i) => (
              <div key={f.id} className="flex gap-2 items-start">
                <Input
                  className="flex-1"
                  value={f.name}
                  placeholder="Field name"
                  onChange={(e) =>
                    patch((sp) => ({
                      ...sp,
                      customFields: sp.customFields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    }))
                  }
                />
                <Select
                  value={f.type}
                  onValueChange={(v) =>
                    patch((sp) => ({
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
                      patch((sp) => ({
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
                  onClick={() => patch((sp) => ({ ...sp, customFields: sp.customFields.filter((_, j) => j !== i) }))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                patch((sp) => ({
                  ...sp,
                  customFields: [...sp.customFields, { id: uid(), name: "", type: "text" }],
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
              checked={space.emailReminders}
              onCheckedChange={(c) => patch((sp) => ({ ...sp, emailReminders: c }))}
            />
          </div>
          <div>
            <Label className="text-xs">Digest time</Label>
            <Input
              type="time"
              value={space.emailDigestTime}
              onChange={(e) => patch((sp) => ({ ...sp, emailDigestTime: e.target.value }))}
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
      </div>
    </div>
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
