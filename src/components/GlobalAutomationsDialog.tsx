import { useState, useEffect } from "react";
import { useStore, type AutomationCondition, type Automation } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export function GlobalAutomationsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, update } = useStore();
  const [automations, setAutomations] = useState<Automation[]>([]);

  // Form State
  const [targetSpaces, setTargetSpaces] = useState<string[]>([]);
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [actionType, setActionType] = useState("send_email");
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});
  const [isRecurring, setIsRecurring] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAutomations();
      resetForm();
    }
  }, [open]);

  const fetchAutomations = async () => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/automations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json() as Automation[];
        setAutomations(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setTargetSpaces([]);
    setConditions([{ type: "due_today" }]);
    setActionType("send_email");
    setActionConfig({ target_user_id: state.currentUserId });
    setIsRecurring(false);
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { type: "task_field", config: { field: "status", operator: "equals", value: "" } }]);
  };

  const updateCondition = (index: number, val: Partial<AutomationCondition>) => {
    const newC = [...conditions];
    newC[index] = { ...newC[index], ...val };
    setConditions(newC);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleAddAutomation = async () => {
    const token = localStorage.getItem("syncduo_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          targetSpaces,
          conditions,
          action_type: actionType,
          config: actionConfig,
          isRecurring
        })
      });
      if (res.ok) {
        const data = await res.json() as Automation;
        setAutomations([...automations, data]);
        toast.success("Global automation added");
        resetForm();
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
      const res = await fetch(`/api/automations/${autoId}`, {
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

  const toggleTargetSpace = (spaceId: string) => {
    if (targetSpaces.includes(spaceId)) {
      setTargetSpaces(targetSpaces.filter(id => id !== spaceId));
    } else {
      setTargetSpaces([...targetSpaces, spaceId]);
    }
  };

  const availableCustomFields = Array.from(new Set(
    state.spaces
      .filter(s => targetSpaces.length === 0 || targetSpaces.includes(s.id))
      .flatMap(s => s.customFields?.map(f => f.id) || [])
  )).map(id => {
    const field = state.spaces.flatMap(s => s.customFields || []).find(f => f.id === id);
    return { id: `custom_${id}`, name: field?.name || id };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Global Automations
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* List existing automations */}
          <section>
            <h3 className="text-sm font-semibold mb-2">Active Automations</h3>
            {automations.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No global automations configured.</p>
            ) : (
              <div className="space-y-2">
                {automations.map((a) => (
                  <div key={a.id} className="bg-card border border-border p-3 rounded-md text-sm flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <p className="font-medium text-xs text-muted-foreground">
                        Targets: {a.targetSpaces.length === 0 ? "Any Space" : a.targetSpaces.map(sid => state.spaces.find(s => s.id === sid)?.name || sid).join(', ')}
                      </p>
                      <div>
                        <span className="font-semibold text-primary">WHEN </span>
                        {a.conditions.length === 0 ? "Any Task" : a.conditions.map(c => c.type.replace('_', ' ')).join(' AND ')}
                      </div>
                      <div>
                        <span className="font-semibold text-primary">THEN </span>
                        {a.action_type.replace('_', ' ')}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Delete automation" className="text-destructive shrink-0" onClick={() => handleDeleteAutomation(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Builder */}
          <section className="bg-secondary/30 p-4 rounded-xl border border-border space-y-4">
            <h3 className="text-sm font-semibold">Create New Automation</h3>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">1. Target Spaces (Leave empty for ALL spaces)</Label>
              <div className="flex flex-wrap gap-2">
                {state.spaces.map(s => (
                  <label key={s.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${targetSpaces.includes(s.id) ? 'bg-primary/20 border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                    <Checkbox checked={targetSpaces.includes(s.id)} onCheckedChange={() => toggleTargetSpace(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">2. Conditions (ALL must be true)</Label>
              {conditions.map((c, i) => {
                const isLegacy = !c.type.startsWith('task_field') && !c.type.startsWith('space_activity');

                return (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2 bg-background p-2 rounded-md border border-border">
                     {isLegacy ? (
                       <>
                         <Select value={c.type} onValueChange={(v) => updateCondition(i, { type: v, config: {} })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="due_today">Due Today</SelectItem>
                              <SelectItem value="has_assignee">Has Assignee</SelectItem>
                              <SelectItem value="no_assignee">No Assignee</SelectItem>
                              <SelectItem value="status_equals">Status Equals...</SelectItem>
                              <SelectItem value="status_not_equals">Status Not Equals...</SelectItem>
                              <SelectItem value="priority_equals">Priority Equals...</SelectItem>
                              <SelectItem value="priority_not_equals">Priority Not Equals...</SelectItem>
                              <SelectItem value="due_date_equals">Due Date Equals...</SelectItem>
                              <SelectItem value="assignee_equals">Assignee Equals...</SelectItem>
                              <SelectItem value="no_new_tasks_created">No New Tasks Created</SelectItem>
                              <SelectItem value="no_new_tasks_in_status">No New Tasks In Status...</SelectItem>
                              <SelectItem value="no_new_tasks_by_user_in_status">No New Tasks By User In Status...</SelectItem>
                              <SelectItem value="no_new_tasks_in_priority">No New Tasks In Priority...</SelectItem>
                              <SelectItem value="no_new_tasks_by_user_in_priority">No New Tasks By User In Priority...</SelectItem>
                              <SelectItem value="task_field">Task Property...</SelectItem>
                              <SelectItem value="space_activity">Space Activity...</SelectItem>
                            </SelectContent>
                         </Select>
                         {(c.type === 'status_equals' || c.type === 'status_not_equals' || c.type === 'no_new_tasks_in_status') && (
                           <Input className="h-8 text-xs" placeholder="Status ID (e.g., done)" value={c.config?.status || ""} onChange={e => updateCondition(i, { config: { ...c.config, status: e.target.value }})} />
                         )}
                         {(c.type === 'priority_equals' || c.type === 'priority_not_equals' || c.type === 'no_new_tasks_in_priority') && (
                           <Select value={c.config?.priority || "low"} onValueChange={v => updateCondition(i, { config: { ...c.config, priority: v } })}>
                             <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
                             <SelectContent>
                               <SelectItem value="low">Low</SelectItem>
                               <SelectItem value="medium">Medium</SelectItem>
                               <SelectItem value="high">High</SelectItem>
                             </SelectContent>
                           </Select>
                         )}
                         {c.type === 'due_date_equals' && (
                           <Input type="date" className="h-8 text-xs" value={c.config?.dueDate || ""} onChange={e => updateCondition(i, { config: { ...c.config, dueDate: e.target.value }})} />
                         )}
                         {c.type === 'assignee_equals' && (
                           <Select value={c.config?.assignee || ""} onValueChange={v => updateCondition(i, { config: { ...c.config, assignee: v } })}>
                             <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Assignee" /></SelectTrigger>
                             <SelectContent>
                               {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                             </SelectContent>
                           </Select>
                         )}
                         {c.type === 'no_new_tasks_by_user_in_status' && (
                           <div className="flex gap-2 w-full mt-2">
                             <Select value={c.config?.user_id || ""} onValueChange={v => updateCondition(i, { config: { ...c.config, user_id: v } })}>
                               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select User" /></SelectTrigger>
                               <SelectContent>
                                 {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                               </SelectContent>
                             </Select>
                             <Input className="h-8 text-xs w-1/2" placeholder="Status ID" value={c.config?.status || ""} onChange={e => updateCondition(i, { config: { ...c.config, status: e.target.value }})} />
                           </div>
                         )}
                         {c.type === 'no_new_tasks_by_user_in_priority' && (
                           <div className="flex gap-2 w-full mt-2">
                             <Select value={c.config?.user_id || ""} onValueChange={v => updateCondition(i, { config: { ...c.config, user_id: v } })}>
                               <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select User" /></SelectTrigger>
                               <SelectContent>
                                 {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                               </SelectContent>
                             </Select>
                             <Select value={c.config?.priority || "low"} onValueChange={v => updateCondition(i, { config: { ...c.config, priority: v } })}>
                               <SelectTrigger className="h-8 text-xs w-1/2"><SelectValue placeholder="Priority" /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="low">Low</SelectItem>
                                 <SelectItem value="medium">Medium</SelectItem>
                                 <SelectItem value="high">High</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                         )}
                       </>
                     ) : (
                       <div className="space-y-2">
                         <Select value={c.type} onValueChange={(v) => {
                           if (v === "task_field") {
                             updateCondition(i, { type: v, config: { field: "status", operator: "equals", value: "" } });
                           } else if (v === "space_activity") {
                             updateCondition(i, { type: v, config: { event: "no_created", user: "any", value: "" } });
                           }
                         }}>
                           <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                           <SelectContent>
                             <SelectItem value="task_field">Task Property...</SelectItem>
                             <SelectItem value="space_activity">Space Activity...</SelectItem>
                           </SelectContent>
                         </Select>

                         {c.type === "task_field" && (
                           <div className="flex gap-2 w-full mt-2">
                             <Select value={c.config?.field || "status"} onValueChange={v => updateCondition(i, { config: { ...c.config, field: v, value: "" } })}>
                               <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Field" /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="status">Status</SelectItem>
                                 <SelectItem value="priority">Priority</SelectItem>
                                 <SelectItem value="assignee">Assignee</SelectItem>
                                 <SelectItem value="due_date">Due Date</SelectItem>
                                 {availableCustomFields.map(f => (
                                   <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                 ))}
                               </SelectContent>
                             </Select>
                             <Select value={c.config?.operator || "equals"} onValueChange={v => updateCondition(i, { config: { ...c.config, operator: v } })}>
                               <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Operator" /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="equals">Equals</SelectItem>
                                 <SelectItem value="not_equals">Not Equals</SelectItem>
                                 <SelectItem value="is_empty">Is Empty</SelectItem>
                                 <SelectItem value="not_empty">Is Not Empty</SelectItem>
                                 {c.config?.field === "due_date" && (
                                   <>
                                     <SelectItem value="is_today">Is Today</SelectItem>
                                     <SelectItem value="is_overdue">Is Overdue</SelectItem>
                                   </>
                                 )}
                               </SelectContent>
                             </Select>
                             {(!["is_empty", "not_empty", "is_today", "is_overdue"].includes(c.config?.operator || "equals")) && (
                               <div className="flex-1">
                                 {c.config?.field === "status" && <Input className="h-8 text-xs w-full" placeholder="Status ID" value={c.config?.value || ""} onChange={e => updateCondition(i, { config: { ...c.config, value: e.target.value }})} />}
                                 {c.config?.field === "priority" && (
                                   <Select value={c.config?.value || ""} onValueChange={v => updateCondition(i, { config: { ...c.config, value: v } })}>
                                     <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="low">Low</SelectItem>
                                       <SelectItem value="medium">Medium</SelectItem>
                                       <SelectItem value="high">High</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 )}
                                 {c.config?.field === "assignee" && (
                                   <Select value={c.config?.value || ""} onValueChange={v => updateCondition(i, { config: { ...c.config, value: v } })}>
                                     <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select Assignee" /></SelectTrigger>
                                     <SelectContent>
                                       {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                                     </SelectContent>
                                   </Select>
                                 )}
                                 {c.config?.field === "due_date" && <Input type="date" className="h-8 text-xs w-full" value={c.config?.value || ""} onChange={e => updateCondition(i, { config: { ...c.config, value: e.target.value }})} />}
                                 {c.config?.field?.startsWith("custom_") && <Input className="h-8 text-xs w-full" placeholder="Value" value={c.config?.value || ""} onChange={e => updateCondition(i, { config: { ...c.config, value: e.target.value }})} />}
                               </div>
                             )}
                           </div>
                         )}

                         {c.type === "space_activity" && (
                           <div className="flex gap-2 w-full mt-2">
                             <Select value={c.config?.event || "no_created"} onValueChange={v => updateCondition(i, { config: { ...c.config, event: v, value: "" } })}>
                               <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Event" /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="no_created">No Tasks Created</SelectItem>
                                 <SelectItem value="no_status">No Status Updates</SelectItem>
                                 <SelectItem value="no_priority">No Priority Updates</SelectItem>
                               </SelectContent>
                             </Select>
                             <Select value={c.config?.user || "any"} onValueChange={v => updateCondition(i, { config: { ...c.config, user: v } })}>
                               <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="By User" /></SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="any">By Anyone</SelectItem>
                                 {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                               </SelectContent>
                             </Select>
                             {["no_status", "no_priority"].includes(c.config?.event) && (
                               <div className="flex-1">
                                 {c.config?.event === "no_status" && <Input className="h-8 text-xs w-full" placeholder="Status ID" value={c.config?.value || ""} onChange={e => updateCondition(i, { config: { ...c.config, value: e.target.value }})} />}
                                 {c.config?.event === "no_priority" && (
                                   <Select value={c.config?.value || "low"} onValueChange={v => updateCondition(i, { config: { ...c.config, value: v } })}>
                                     <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Priority" /></SelectTrigger>
                                     <SelectContent>
                                       <SelectItem value="low">Low</SelectItem>
                                       <SelectItem value="medium">Medium</SelectItem>
                                       <SelectItem value="high">High</SelectItem>
                                     </SelectContent>
                                   </Select>
                                 )}
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                     )}
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remove condition" className="shrink-0 h-8 w-8 text-destructive" onClick={() => removeCondition(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )})}
              <Button variant="outline" size="sm" className="h-8 text-xs mt-1" onClick={handleAddCondition}>
                <Plus className="h-3 w-3 mr-1" /> Add Condition
              </Button>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-semibold">3. Action</Label>
              <Select value={actionType} onValueChange={(v) => {
                setActionType(v);
                if (v === "send_email") setActionConfig({ target_user_id: state.currentUserId });
                else if (v === "change_status") setActionConfig({ new_status: "done" });
                else if (v === "move_space") setActionConfig({ new_space_id: state.spaces[0]?.id || "" });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Send Email To User</SelectItem>
                  <SelectItem value="change_status">Change Status</SelectItem>
                  <SelectItem value="move_space">Move Space</SelectItem>
                </SelectContent>
              </Select>

              {actionType === "send_email" && (
                <div className="mt-2 space-y-1">
                  <Label className="text-xs">Select User</Label>
                  <Select value={actionConfig.target_user_id} onValueChange={(v) => setActionConfig({ ...actionConfig, target_user_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {state.users.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {actionType === "change_status" && (
                <div className="mt-2 space-y-1">
                  <Label className="text-xs">New Status ID</Label>
                  <Input value={actionConfig.new_status || ""} onChange={(e) => setActionConfig({ ...actionConfig, new_status: e.target.value })} />
                </div>
              )}
              {actionType === "move_space" && (
                <div className="mt-2 space-y-1">
                  <Label className="text-xs">Destination Space</Label>
                  <Select value={actionConfig.new_space_id} onValueChange={(v) => setActionConfig({ ...actionConfig, new_space_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {state.spaces.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
               <Checkbox id="recurring-check" checked={isRecurring} onCheckedChange={(v) => setIsRecurring(!!v)} />
               <Label htmlFor="recurring-check" className="text-sm cursor-pointer">Repeat daily if conditions are met</Label>
            </div>

            <Button className="w-full mt-4" onClick={handleAddAutomation}>
              Save Automation
            </Button>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
