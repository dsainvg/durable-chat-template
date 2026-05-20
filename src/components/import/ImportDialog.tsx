import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { parseExcelFile } from "@/lib/ImportExportUtils";
import { useStore, uid, type Space, type Task, type CustomField } from "@/lib/store";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: Space;
}

const STANDARD_FIELDS = [
  { id: "title", label: "Title" },
  { id: "description", label: "Description" },
  { id: "status", label: "Status" },
  { id: "assignee", label: "Assignee" },
  { id: "dueDate", label: "Due Date" },
  { id: "priority", label: "Priority" },
];

export function ImportDialog({ open, onOpenChange, space }: ImportDialogProps) {
  const { state, update } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [createExtraFields, setCreateExtraFields] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  // All available fields in the app to map to
  const availableFields = useMemo(() => {
    return [
      ...STANDARD_FIELDS,
      ...(space.customFields || []).map((cf) => ({ id: `custom_${cf.id}`, label: cf.name })),
    ];
  }, [space.customFields]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    try {
      const { headers: parsedHeaders, rows: parsedRows } = await parseExcelFile(selectedFile);
      setHeaders(parsedHeaders);
      setRows(parsedRows);

      // Intelligent mapping
      const initialMapping: Record<string, string> = {};
      parsedHeaders.forEach((header) => {
        const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, "");

        // Find best match in standard and custom fields
        const match = availableFields.find((f) => {
          const lowerLabel = f.label.toLowerCase().replace(/[^a-z0-9]/g, "");
          return lowerHeader.includes(lowerLabel) || lowerLabel.includes(lowerHeader);
        });

        if (match) {
          initialMapping[header] = match.id;
        } else {
           initialMapping[header] = ""; // unmapped
        }
      });
      setMapping(initialMapping);
    } catch (error) {
      console.error(error);
      toast.error("Failed to parse file.");
    }
  };

  const handleMappingChange = (header: string, fieldId: string) => {
    setMapping((prev) => ({ ...prev, [header]: fieldId === "ignore" ? "" : fieldId }));
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setIsImporting(true);

    try {
      const token = localStorage.getItem("syncduo_token");
      if (!token) throw new Error("No token found");

      let updatedSpace = { ...space };

      // 1. Create extra custom fields if requested
      const unmappedHeaders = headers.filter((h) => !mapping[h]);
      if (createExtraFields && unmappedHeaders.length > 0) {
        const newCustomFields: CustomField[] = unmappedHeaders.map((header) => ({
          id: uid(),
          name: header,
          type: "text", // default to text
          required: false,
        }));

        updatedSpace.customFields = [...(updatedSpace.customFields || []), ...newCustomFields];

        // Sync to backend
        const putRes = await fetch(`/api/spaces/${space.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
             ...updatedSpace
          }),
        });

        if (!putRes.ok) throw new Error("Failed to update space with new fields");

        // Update frontend store
        update((s) => ({
          ...s,
          spaces: s.spaces.map((sp) => (sp.id === space.id ? updatedSpace : sp)),
        }));

        // Update mapping to link newly created fields to their headers
        newCustomFields.forEach(cf => {
             mapping[cf.name] = `custom_${cf.id}`;
        });
      }

      // 2. Process rows into tasks
      const newTasks: Task[] = [];
      for (const row of rows) {
        const task: Task = {
          id: uid(),
          title: "Imported Task",
          description: "",
          status: space.columns[0]?.id || "todo", // default status
          assignee: "",
          dueDate: "",
          startDate: "",
          priority: "medium",
          custom: {},
        };

        for (const [header, fieldId] of Object.entries(mapping)) {
           if (!fieldId) continue;

           const value = row[header];
           if (value === undefined || value === null || value === "") continue;

           if (fieldId.startsWith("custom_")) {
              const customFieldId = fieldId.replace("custom_", "");
              task.custom[customFieldId] = String(value);
           } else if (fieldId === "title") {
              task.title = String(value);
           } else if (fieldId === "description") {
              task.description = String(value);
           } else if (fieldId === "status") {
              // Try to find matching column
              const col = updatedSpace.columns.find(c => c.name.toLowerCase() === String(value).toLowerCase());
              if (col) task.status = col.id;
           } else if (fieldId === "assignee") {
              // Try to find matching user (by name)
              const user = state.users.find(u => u.name.toLowerCase() === String(value).toLowerCase());
              if (user) task.assignee = user.id;
           } else if (fieldId === "dueDate") {
              task.dueDate = new Date(value).toISOString();
           } else if (fieldId === "priority") {
              const lowerVal = String(value).toLowerCase();
              if (["low", "medium", "high"].includes(lowerVal)) {
                 task.priority = lowerVal as "low" | "medium" | "high";
              }
           }
        }

        newTasks.push(task);
      }

      // 3. Submit tasks to backend
      for (const task of newTasks) {
          const res = await fetch(`/api/tasks?space_id=${space.id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(task),
          });
          if (!res.ok) {
             console.error(`Failed to import task ${task.title}`);
          }
      }

      toast.success(`Imported ${newTasks.length} tasks successfully.`);
      onOpenChange(false);
      setFile(null);
      setHeaders([]);
      setRows([]);
      setMapping({});

    } catch (error) {
      console.error(error);
      toast.error("An error occurred during import.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tasks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="file-upload">Excel or CSV File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              disabled={isImporting}
            />
          </div>

          {headers.length > 0 && (
            <div className="space-y-4 border p-4 rounded-md bg-muted/30">
              <h3 className="font-semibold text-sm">Map Columns</h3>
              <p className="text-xs text-muted-foreground">
                Match your file's columns to task fields. Unmapped columns will be ignored unless you check the box below.
              </p>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {headers.map((header) => (
                  <div key={header} className="flex items-center gap-4 bg-background p-2 rounded-md border text-sm">
                    <span className="font-medium w-1/3 truncate" title={header}>{header}</span>
                    <span className="text-muted-foreground w-6 text-center">→</span>
                    <Select
                      value={mapping[header] || "ignore"}
                      onValueChange={(val) => handleMappingChange(header, val)}
                      disabled={isImporting}
                    >
                      <SelectTrigger className="flex-1 h-8">
                        <SelectValue placeholder="Ignore (Do not import)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">-- Ignore (Do not import) --</SelectItem>
                        {availableFields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex items-center space-x-2 mt-4">
                <Checkbox
                  id="create-extra"
                  checked={createExtraFields}
                  onCheckedChange={(checked) => setCreateExtraFields(!!checked)}
                  disabled={isImporting}
                />
                <label
                  htmlFor="create-extra"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Create custom fields for unmapped columns
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || headers.length === 0 || isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
