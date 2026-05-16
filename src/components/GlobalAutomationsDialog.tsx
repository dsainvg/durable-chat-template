import { useState, useEffect } from "react";
import { useStore, uid, type Automation } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export function GlobalAutomationsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, update } = useStore();
  const [localAutomations, setLocalAutomations] = useState<Automation[]>([]);

  useEffect(() => {
    if (open) {
      setLocalAutomations(state.automations || []);
    }
  }, [open, state.automations]);

  const patchAuto = (i: number, fn: (a: Automation) => Automation) => {
    setLocalAutomations(prev => prev.map((x, j) => j === i ? fn(x) : x));
  };

  const handleSave = async () => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;

    try {
      // Very basic sync for the prototype: we assume we just send the automations down
      // But actually we have specific endpoints. To keep it simple, we will iterate and sync.

      // Get existing from DB
      const res = await fetch("/api/automations", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dbAutos = await res.json() as Automation[];

      // Map to track what's handled
      const handled = new Set<string>();

      for (const auto of localAutomations) {
        handled.add(auto.id);
        const isNew = !dbAutos.find(d => d.id === auto.id);
        if (isNew) {
          await fetch("/api/automations", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(auto)
          });
        } else {
          await fetch(`/api/automations/${auto.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(auto)
          });
        }
      }

      // Delete removed
      for (const dbA of dbAutos) {
        if (!handled.has(dbA.id)) {
          await fetch(`/api/automations/${dbA.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }

      // Re-fetch to update store
      const finalRes = await fetch("/api/automations", { headers: { Authorization: `Bearer ${token}` } });
      const finalAutos = await finalRes.json() as Automation[];
      update(s => ({ ...s, automations: finalAutos }));

      toast.success("Automations saved.");
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to save automations.");
      console.error(e);
    }
  };

  const addAutomation = () => {
    setLocalAutomations(prev => [
      ...prev,
      {
        id: uid(),
        name: `Automation ${prev.length + 1}`,
        enabled: true,
        target_spaces: [],
        condition_type: "unassigned",
        condition_payload: {},
        action_type: "set_status",
        action_payload: {}
      }
    ]);
  };

  const toggleTargetSpace = (i: number, spaceId: string) => {
    patchAuto(i, auto => {
      const ts = auto.target_spaces || [];
      if (ts.includes(spaceId)) {
        return { ...auto, target_spaces: ts.filter(s => s !== spaceId) };
      } else {
        return { ...auto, target_spaces: [...ts, spaceId] };
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Global Automations</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">Configure automated workflows across all your spaces.</p>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 pt-0 space-y-6">
          <div className="space-y-4">
            {localAutomations.map((auto, i) => (
              <div key={auto.id} className="border border-border p-4 rounded-lg space-y-4 bg-card">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={auto.enabled}
                      onCheckedChange={(c) => patchAuto(i, a => ({ ...a, enabled: c }))}
                    />
                    <Input
                      value={auto.name}
                      onChange={(e) => patchAuto(i, a => ({ ...a, name: e.target.value }))}
                      className="h-8 font-medium bg-transparent border-transparent hover:border-input focus:border-input px-2 w-48"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setLocalAutomations(p => p.filter((_, j) => j !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Target Spaces (empty = all spaces)</Label>
                  <div className="flex flex-wrap gap-2">
                    {state.spaces.map(s => {
                      const isSelected = (auto.target_spaces || []).includes(s.id);
                      return (
                        <Badge
                          key={s.id}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleTargetSpace(i, s.id)}
                        >
                          {s.emoji} {s.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">When this happens...</Label>
                    <Select
                      value={auto.condition_type}
                      onValueChange={(v) => patchAuto(i, a => ({ ...a, condition_type: v as any }))}
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
                      onValueChange={(v) => patchAuto(i, a => ({ ...a, action_type: v as any }))}
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

                <div className="space-y-2 border-t border-border pt-4 mt-2">
                  {auto.action_type === "set_status" && (
                    <>
                      <Label className="text-xs">Target Status (Make sure column exists in target space)</Label>
                      <Input
                        placeholder="Column ID (e.g. todo, doing, done)"
                        value={auto.action_payload?.status || ""}
                        onChange={(e) => patchAuto(i, a => ({ ...a, action_payload: { ...a.action_payload, status: e.target.value } }))}
                      />
                    </>
                  )}

                  {auto.action_type === "send_email" && (
                    <>
                      <Label className="text-xs">Target Email</Label>
                      <Input
                        placeholder="Email address"
                        value={auto.action_payload?.email || ""}
                        onChange={(e) => patchAuto(i, a => ({ ...a, action_payload: { ...a.action_payload, email: e.target.value } }))}
                      />
                    </>
                  )}

                  {auto.action_type === "move_space" && (
                    <>
                      <Label className="text-xs">Target Space</Label>
                      <Select
                        value={auto.action_payload?.space_id || ""}
                        onValueChange={(v) => patchAuto(i, a => ({ ...a, action_payload: { ...a.action_payload, space_id: v } }))}
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
              className="w-full border-dashed py-8 text-muted-foreground hover:text-foreground"
              onClick={addAutomation}
            >
              <Plus className="mr-2 size-4" /> Add Automation
            </Button>
          </div>
        </ScrollArea>

        <div className="p-6 pt-4 border-t border-border bg-muted/50 rounded-b-lg flex justify-end">
          <Button variant="outline" className="mr-2" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Automations</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
