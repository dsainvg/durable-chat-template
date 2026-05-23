import { useState } from "react";
import type { Space, Task, User } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function TaskDialog({
  task,
  space,
  users,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task;
  space: Space;
  users: User[];
  isNew: boolean;
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Task>(task);

  const set = <K extends keyof Task>(k: K, v: Task[K]) => setDraft({ ...draft, [k]: v });
  const setCustom = (id: string, v: string) =>
    setDraft({ ...draft, custom: { ...draft.custom, [id]: v } });

  const toDateInput = (iso: string) => iso.slice(0, 10);
  const fromDateInput = (s: string) => new Date(s).toISOString();

  const missingRequiredFields = () => {
    if (!draft.title.trim()) return true;
    for (const f of space.customFields) {
      if (f.required) {
        const val = draft.custom[f.id];
        if (val === undefined || val === null || val.toString().trim() === "") {
          return true;
        }
      }
    }
    return false;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New task" : "Edit task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="task-title" className="text-xs">Title <span className="text-destructive">*</span></Label>
            <Input id="task-title" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Task title…" autoFocus />
          </div>
          <div>
            <Label htmlFor="task-description" className="text-xs">Description</Label>
            <Textarea id="task-description" value={draft.description} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-status" className="text-xs">Status</Label>
              <Select value={draft.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger id="task-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="doing">Doing</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-priority" className="text-xs">Priority</Label>
              <Select value={draft.priority} onValueChange={(v) => set("priority", v as Task["priority"])}>
                <SelectTrigger id="task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-assignee" className="text-xs">Assignee</Label>
              <Select value={draft.assignee} onValueChange={(v) => set("assignee", v)}>
                <SelectTrigger id="task-assignee"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-start" className="text-xs">Start</Label>
              <Input id="task-start" type="date" value={toDateInput(draft.startDate)} onChange={(e) => set("startDate", fromDateInput(e.target.value))} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="task-due" className="text-xs">Due date</Label>
              <Input id="task-due" type="date" value={toDateInput(draft.dueDate)} onChange={(e) => set("dueDate", fromDateInput(e.target.value))} />
            </div>
          </div>

          {space.customFields.length > 0 && (
            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Custom fields</p>
              {space.customFields.map((f) => (
                <div key={f.id}>
                  <Label htmlFor={`task-custom-${f.id}`} className="text-xs">{f.name} {f.required && <span className="text-destructive">*</span>}</Label>
                  {f.type === "select" ? (
                    <Select value={draft.custom[f.id] ?? ""} onValueChange={(v) => setCustom(f.id, v)}>
                      <SelectTrigger id={`task-custom-${f.id}`}><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : f.type === "date" ? (
                    <Input id={`task-custom-${f.id}`} type="date" value={draft.custom[f.id] ?? ""} onChange={(e) => setCustom(f.id, e.target.value)} />
                  ) : (
                    <Input
                      id={`task-custom-${f.id}`}
                      type={f.type === "number" ? "number" : "text"}
                      value={draft.custom[f.id] ?? ""}
                      onChange={(e) => setCustom(f.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          {!isNew ? (

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive">Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the task
                    "{draft.title}".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(draft)} disabled={missingRequiredFields()}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
