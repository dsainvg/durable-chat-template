import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uid, type Space, type Task } from "@/lib/store";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  space: Space;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (tasks: Task[], newlyCreatedFields?: { id: string; name: string; type: any }[]) => void;
}

export function ExcelImportDialog({ space, open, onOpenChange, onImport }: Props) {
  const [step, setStep] = useState<"upload" | "map" | "value_map">("upload");
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [valueMapping, setValueMapping] = useState<Record<string, Record<string, string>>>({});
  const [valueMapFields, setValueMapFields] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableFields = [
    { id: "title", name: "Title (Required)" },
    { id: "description", name: "Description" },
    { id: "status", name: "Status (Column Name)" },
    { id: "assignee", name: "Assignee Email" },
    { id: "priority", name: "Priority (low/medium/high)" },
    { id: "dueDate", name: "Due Date" },
    { id: "startDate", name: "Start Date" },
    ...space.customFields.map((f) => ({ id: `custom_${f.id}`, name: `Custom: ${f.name}` })),
    { id: "create_custom", name: "Create new custom field..." }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          toast.error("File is empty or missing headers");
          return;
        }

        const headers = (jsonData[0] as string[]).map(h => String(h || "").trim());
        const rows = jsonData.slice(1).map((row) => {
          const obj: any = {};
          headers.forEach((h, i) => {
            if (h) obj[h] = row[i];
          });
          return obj;
        });

        const validHeaders = headers.filter(h => h);
        setColumns(validHeaders);
        setData(rows);

        // Auto-map columns intelligently
        const initialMapping: Record<string, string> = {};
        validHeaders.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes("title") || lower.includes("name") || lower === "task") initialMapping[h] = "title";
          else if (lower.includes("desc") || lower.includes("summary")) initialMapping[h] = "description";
          else if (lower.includes("status") || lower.includes("column") || lower === "state") initialMapping[h] = "status";
          else if (lower.includes("assignee") || lower.includes("user") || lower.includes("owner")) initialMapping[h] = "assignee";
          else if (lower.includes("priority")) initialMapping[h] = "priority";
          else if (lower.includes("due") || lower.includes("deadline")) initialMapping[h] = "dueDate";
          else if (lower.includes("start")) initialMapping[h] = "startDate";
          else {
            const match = space.customFields.find((f) => f.name.toLowerCase() === lower);
            if (match) initialMapping[h] = `custom_${match.id}`;
            else initialMapping[h] = "create_custom"; // By default track extra fields as new custom fields
          }
        });
        setMapping(initialMapping);
        setStep("map");
      } catch (err) {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsBinaryString(file);
  };


  const handleMapNext = () => {
    // Check if any mapped columns require value mapping (status, priority, select custom fields)
    const fieldsToMapValues: string[] = [];
    Object.entries(mapping).forEach(([col, field]) => {
      if (field === "status" || field === "priority") {
        fieldsToMapValues.push(col);
      } else if (field.startsWith("custom_")) {
        const cid = field.replace("custom_", "");
        const customField = space.customFields.find((f) => f.id === cid);
        if (customField?.type === "select") {
          fieldsToMapValues.push(col);
        }
      }
    });

    if (fieldsToMapValues.length > 0) {
      // Auto-map values where possible
      const initialValueMapping: Record<string, Record<string, string>> = {};

      fieldsToMapValues.forEach(col => {
        initialValueMapping[col] = {};
        const uniqueValues = Array.from(new Set(data.map(row => String(row[col] || "")).filter(v => v)));

        const field = mapping[col];
        let options: { id: string; name: string }[] = [];

        if (field === "status") {
          options = space.columns.map(c => ({ id: c.id, name: c.name }));
        } else if (field === "priority") {
          options = [
            { id: "low", name: "Low" },
            { id: "medium", name: "Medium" },
            { id: "high", name: "High" }
          ];
        } else if (field.startsWith("custom_")) {
          const cid = field.replace("custom_", "");
          const customField = space.customFields.find((f) => f.id === cid);
          options = (customField?.options || []).map(opt => ({ id: opt, name: opt }));
        }

        uniqueValues.forEach(val => {
          // Attempt to auto-match by name
          const match = options.find(opt => opt.name.toLowerCase() === val.toLowerCase());
          if (match) {
            initialValueMapping[col][val] = match.id;
          } else {
            // Default to first option if no match, or leave blank if we want to force user to map
            initialValueMapping[col][val] = options[0]?.id || "";
          }
        });
      });

      setValueMapping(initialValueMapping);
      setValueMapFields(fieldsToMapValues);
      setStep("value_map");
    } else {
      // No value mapping needed, go straight to import
      handleImport();
    }
  };


  const handleImport = async () => {
    // Need to find title mapping
    const titleCol = Object.keys(mapping).find((k) => mapping[k] === "title");
    if (!titleCol) {
      toast.error("You must map at least one column to 'Title'");
      return;
    }

    const defaultStatus = space.columns[0]?.id || "todo";
    const now = new Date().toISOString();

    // Check if we need to create new custom fields
    const colsToCreate = Object.keys(mapping).filter(k => mapping[k] === "create_custom");
    let updatedSpace = { ...space };
    let createdCustomFields: { id: string; name: string; type: any }[] = [];

    if (colsToCreate.length > 0) {
      createdCustomFields = colsToCreate.map(col => ({
        id: uid(),
        name: col,
        type: "text" as const, // Default to text
      }));

      updatedSpace.customFields = [...updatedSpace.customFields, ...createdCustomFields];

      // We also update the mapping to map to these new custom fields
      const newMapping = { ...mapping };
      colsToCreate.forEach((col, idx) => {
        newMapping[col] = `custom_${createdCustomFields[idx].id}`;
      });
      setMapping(newMapping); // though we don't strictly need to setState here since we use it below

      // Update space on backend (so the new fields exist)
      try {
        const token = localStorage.getItem("syncduo_token");
        if (token) {
          await fetch(`/api/spaces/${space.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(updatedSpace)
          });
        }
      } catch(e) {
        console.error("Failed to update space with new custom fields", e);
      }

      // We override mapping for task creation
      colsToCreate.forEach((col, idx) => {
        mapping[col] = `custom_${createdCustomFields[idx].id}`;
      });
    }

    const tasks: Task[] = data.map((row) => {
      const task: Task = {
        id: uid(),
        title: String(row[titleCol] || "Untitled"),
        description: "",
        status: defaultStatus,
        assignee: "",
        dueDate: now,
        startDate: now,
        priority: "medium",
        custom: {},
      };

      Object.entries(mapping).forEach(([col, field]) => {
        if (!field || field === "title" || row[col] == null || field === "ignore") return;
        const val = String(row[col]);

        if (field === "description") task.description = val;
        else if (field === "status") {
          const mappedVal = valueMapping[col]?.[val];
          if (mappedVal) task.status = mappedVal;
        }
        else if (field === "assignee") {
          task.assignee = val; // Assuming we map emails to assignee fields and we can resolve on server or let it be
        }
        else if (field === "priority") {
          const mappedVal = valueMapping[col]?.[val];
          if (mappedVal === "low" || mappedVal === "medium" || mappedVal === "high") task.priority = mappedVal;
        }
        else if (field === "dueDate") {
          // If the cell was parsed as a Date object by XLSX (due to cellDates: true)
          // `row[col]` might actually be a Date object. Let's handle it safely.
          const d = row[col] instanceof Date ? row[col] : new Date(val);
          if (!isNaN(d.getTime())) task.dueDate = d.toISOString();
        }
        else if (field === "startDate") {
          const d = row[col] instanceof Date ? row[col] : new Date(val);
          if (!isNaN(d.getTime())) task.startDate = d.toISOString();
        }
        else if (field.startsWith("custom_")) {
          const cid = field.replace("custom_", "");
          const customField = space.customFields.find((f) => f.id === cid);
          if (customField?.type === "select") {
            const mappedVal = valueMapping[col]?.[val];
            if (mappedVal) task.custom[cid] = mappedVal;
          } else {
            task.custom[cid] = val;
          }
        }
      });

      return task;
    });

    onImport(tasks, createdCustomFields);
    onOpenChange(false);
  };

  const reset = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setTimeout(() => {
        setStep("upload");
        setData([]);
        setColumns([]);
        setMapping({});
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Excel/CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileUpload}
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 size-4" /> Select File
            </Button>
            <p className="text-sm text-muted-foreground">Supported formats: .xlsx, .xls, .csv</p>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your spreadsheet columns to task fields. We've auto-mapped them where possible. Unmapped extra fields can be tracked as new Custom Fields.
            </p>
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-4">
                {columns.map((col) => (
                  <div key={col} className="grid grid-cols-2 items-center gap-4">
                    <Label className="truncate" title={col}>{col}</Label>
                    <Select
                      value={mapping[col] || "ignore"}
                      onValueChange={(val) => setMapping({ ...mapping, [col]: val === "ignore" ? "" : val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Ignore" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignore">Ignore</SelectItem>
                        {availableFields.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handleMapNext}>Next</Button>
            </DialogFooter>
          </div>
        )}

        {step === "value_map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map the values in your spreadsheet to the options available in Sync Duo.
            </p>
            <ScrollArea className="h-[300px] border rounded-md p-4">
              <div className="space-y-6">
                {valueMapFields.map((col) => {
                  const fieldId = mapping[col];
                  let fieldName = col;
                  let options: { id: string; name: string }[] = [];

                  if (fieldId === "status") {
                    fieldName = "Status";
                    options = space.columns.map(c => ({ id: c.id, name: c.name }));
                  } else if (fieldId === "priority") {
                    fieldName = "Priority";
                    options = [
                      { id: "low", name: "Low" },
                      { id: "medium", name: "Medium" },
                      { id: "high", name: "High" }
                    ];
                  } else if (fieldId.startsWith("custom_")) {
                    const cid = fieldId.replace("custom_", "");
                    const customField = space.customFields.find((f) => f.id === cid);
                    fieldName = customField?.name || col;
                    options = (customField?.options || []).map(opt => ({ id: opt, name: opt }));
                  }

                  const uniqueValues = Object.keys(valueMapping[col] || {});

                  if (uniqueValues.length === 0) return null;

                  return (
                    <div key={col} className="space-y-3">
                      <h4 className="font-semibold text-sm border-b pb-1">{col} ➔ {fieldName}</h4>
                      {uniqueValues.map(val => (
                        <div key={val} className="grid grid-cols-2 items-center gap-4 pl-2">
                          <Label className="truncate text-sm" title={val}>"{val}"</Label>
                          <Select
                            value={valueMapping[col]?.[val] || ""}
                            onValueChange={(newVal) => setValueMapping(prev => ({ ...prev, [col]: { ...prev[col], [val]: newVal } }))}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select option" />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport}>Import {data.length} Tasks</Button>
            </DialogFooter>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
