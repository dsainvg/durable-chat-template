import * as React from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Task, type Space, type User, uid } from "@/lib/store";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, Plus, X } from "lucide-react";

interface ExcelIntegrationProps {
  space: Space;
  users: User[];
  onImport: (tasks: Task[], newCustomFields?: { id: string; name: string; type: any }[]) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STANDARD_FIELDS = [
  { id: "title", label: "Title", required: true },
  { id: "description", label: "Description" },
  { id: "status", label: "Status" },
  { id: "assignee", label: "Assignee" },
  { id: "dueDate", label: "Due Date" },
  { id: "priority", label: "Priority" },
];

export function exportToExcel(tasks: Task[], space: Space, users: User[]) {
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const statusLabels: Record<string, string> = {
    todo: "To Do",
    doing: "Doing",
    done: "Done"
  };

  const data = tasks.map((t) => {
    const row: Record<string, any> = {
      Title: t.title,
      Description: t.description,
      Status: statusLabels[t.status] || t.status,
      Assignee: userMap[t.assignee] || t.assignee,
      "Due Date": t.dueDate,
      Priority: t.priority,
    };

    // Add custom fields
    space.customFields.forEach((f) => {
      row[f.name] = t.custom[f.id] || "";
    });

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tasks");
  XLSX.writeFile(wb, `${space.name.replace(/\s+/g, "_")}_tasks.xlsx`);
}

export function ExcelImportDialog({ space, users, onImport, open, onOpenChange }: ExcelIntegrationProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [data, setData] = React.useState<any[]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [step, setStep] = React.useState<"upload" | "mapping" | "options" | "preview">("upload");
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [extraFieldTypes, setExtraFieldTypes] = React.useState<Record<string, any>>({});
  const [optionMappings, setOptionMappings] = React.useState<Record<string, Record<string, string>>>({});
  const [uniqueValues, setUniqueValues] = React.useState<Record<string, string[]>>({});
  const [importing, setImporting] = React.useState(false);
  const [constantMappings, setConstantMappings] = React.useState<{ id: string; field: string; type: 'constant' | 'date_plus_rowid'; value: string }[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (json.length > 0) {
        const h = json[0] as string[];
        const d = json.slice(1);
        setHeaders(h);
        setData(d);
        setConstantMappings([]);

        // Initial intelligent mapping
        const initialMapping: Record<string, string> = {};
        h.forEach((header) => {
          const lower = header.toLowerCase().replace(/[^a-z]/g, "");
          if (lower === "title" || lower === "task" || lower === "name") initialMapping[header] = "title";
          else if (lower === "description" || lower === "desc") initialMapping[header] = "description";
          else if (lower === "status" || lower === "state") initialMapping[header] = "status";
          else if (lower === "assignee" || lower === "owner" || lower === "user") initialMapping[header] = "assignee";
          else if (lower === "duedate" || lower === "due") initialMapping[header] = "dueDate";
          else if (lower === "priority") initialMapping[header] = "priority";
          else {
            // Check custom fields
            const cf = space.customFields.find(f => f.name.toLowerCase() === header.toLowerCase());
            if (cf) initialMapping[header] = `custom_${cf.id}`;
            else initialMapping[header] = "extra"; // Mark as extra to be potentially created
          }
        });
        setMapping(initialMapping);
        const initialTypes: Record<string, any> = {};
        h.forEach(header => initialTypes[header] = "text");
        setExtraFieldTypes(initialTypes);
        setStep("mapping");
      }
    };
    reader.readAsBinaryString(f);
  };

  const finalizeImport = async () => {
    setImporting(true);
    try {
      const newCustomFieldsToCreate: { id: string; name: string; type: any }[] = [];
      const extraHeaderToId: Record<string, string> = {};

      // Prepare new custom fields IDs
      Object.entries(mapping).forEach(([header, target]) => {
        if (target === "extra") {
          const newId = uid();
          extraHeaderToId[header] = newId;
          newCustomFieldsToCreate.push({ id: newId, name: header, type: extraFieldTypes[header] || "text" });
        }
      });

      const tasksToImport: Task[] = data.map((row, rowIndex) => {
        const task: any = {
          id: uid(),
          title: "",
          description: "",
          status: "todo",
          assignee: "",
          dueDate: "",
          startDate: new Date().toISOString(),
          priority: "medium",
          custom: {},
        };

        headers.forEach((h, i) => {
          const mapTo = mapping[h];
          if (!mapTo || mapTo === "skip") return;
          const val = row[i];
          if (val === undefined || val === null) return;

          if (mapTo === "title") task.title = String(val);
          else if (mapTo === "description") task.description = String(val);
          else if (mapTo === "status") {
            const mappedVal = optionMappings[h]?.[String(val)];
            const hardcodedStatuses = [
              { id: "todo", name: "To Do" },
              { id: "doing", name: "Doing" },
              { id: "done", name: "Done" }
            ];
            const col = hardcodedStatuses.find(c => c.id === mappedVal || c.name === mappedVal || c.name.toLowerCase() === String(val).toLowerCase());
            task.status = col ? col.id : "todo";
          }
          else if (mapTo === "assignee") {
            const mappedVal = optionMappings[h]?.[String(val)];
            const user = users.find(u => u.id === mappedVal || u.name === mappedVal || u.name.toLowerCase() === String(val).toLowerCase() || u.email.toLowerCase() === String(val).toLowerCase());
            task.assignee = user ? user.id : "";
          }
          else if (mapTo === "dueDate") {
            try {
              if (typeof val === 'number') {
                const d = XLSX.SSF.parse_date_code(val);
                task.dueDate = new Date(d.y, d.m - 1, d.d).toISOString();
              } else {
                const s = String(val);
                const parsed = new Date(s);
                if (!isNaN(parsed.getTime())) {
                  task.dueDate = parsed.toISOString();
                } else {
                  // Try common formats like DD/MM/YYYY, MM/DD/YYYY, YYYY/MM/DD
                  const parts = s.split(/[\/\-\.]/).map(p => parseInt(p));
                  if (parts.length === 3) {
                    let d, m, y;
                    if (parts[0] > 1000) { // YYYY-MM-DD
                      y = parts[0]; m = parts[1] - 1; d = parts[2];
                    } else if (parts[2] > 1000) { // DD-MM-YYYY or MM-DD-YYYY
                      y = parts[2];
                      // Ambiguous. We'll guess DD-MM-YYYY unless m > 12
                      if (parts[1] > 12) { // must be MM-DD-YYYY? No, wait, if m > 12 it's invalid unless it's DD.
                         // If parts[0] > 12, it's definitely DD-MM-YYYY.
                         // If parts[1] > 12, it's definitely MM-DD-YYYY.
                         if (parts[0] > 12) { d = parts[0]; m = parts[1] - 1; }
                         else { d = parts[1]; m = parts[0] - 1; }
                      } else {
                         // Default to DD-MM-YYYY
                         d = parts[0]; m = parts[1] - 1;
                      }
                    }
                    if (y && m !== undefined && d) {
                      task.dueDate = new Date(y, m, d).toISOString();
                    }
                  }
                }
              }
            } catch {
              task.dueDate = "";
            }
          }
          else if (mapTo === "priority") {
            const mappedVal = optionMappings[h]?.[String(val)] || String(val).toLowerCase();
            if (["high", "medium", "low"].includes(mappedVal)) task.priority = mappedVal;
            else task.priority = "medium";
          }
          else if (mapTo.startsWith("custom_")) {
            const fieldId = mapTo.replace("custom_", "");
            const customField = space.customFields.find(f => f.id === fieldId);
            if (customField?.type === "select") {
              task.custom[fieldId] = optionMappings[h]?.[String(val)] || String(val);
            } else {
              task.custom[fieldId] = String(val);
            }
          }
          else if (mapTo === "extra") {
            const newId = extraHeaderToId[h];
            if (newId) task.custom[newId] = String(val);
          }
        });

        constantMappings.forEach(c => {
          let val = c.value;
          if (c.type === "date_plus_rowid") {
             const d = new Date(c.value);
             if (!isNaN(d.getTime())) {
                d.setDate(d.getDate() + rowIndex);
                val = d.toISOString();
             } else {
                val = "";
             }
          }

          if (val === undefined || val === null || val === "") return;

          if (c.field === "title") task.title = String(val);
          else if (c.field === "description") task.description = String(val);
          else if (c.field === "status") {
            const hardcodedStatuses = [
              { id: "todo", name: "To Do" },
              { id: "doing", name: "Doing" },
              { id: "done", name: "Done" }
            ];
            const col = hardcodedStatuses.find(col => col.name.toLowerCase() === String(val).toLowerCase() || col.id === String(val).toLowerCase());
            if (col) task.status = col.id;
          }
          else if (c.field === "assignee") {
            const user = users.find(u => u.name.toLowerCase() === String(val).toLowerCase() || u.email.toLowerCase() === String(val).toLowerCase() || u.id === String(val));
            if (user) task.assignee = user.id;
          }
          else if (c.field === "dueDate") {
            const parsed = new Date(val);
            if (!isNaN(parsed.getTime())) {
              task.dueDate = parsed.toISOString();
            }
          }
          else if (c.field === "priority") {
            const lower = String(val).toLowerCase();
            if (["high", "medium", "low"].includes(lower)) task.priority = lower;
          }
          else if (c.field.startsWith("custom_")) {
            const fieldId = c.field.replace("custom_", "");
            task.custom[fieldId] = String(val);
          }
        });

        if (!task.title) task.title = "Imported Task";
        return task;
      });

      await onImport(tasksToImport, newCustomFieldsToCreate);
      toast.success(`Successfully imported ${tasksToImport.length} tasks`);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to import tasks");
    } finally {
      setImporting(false);
    }
  };

  const handleMappingChange = (header: string, value: string) => {
    setMapping(prev => ({ ...prev, [header]: value }));
  };

  const prepareOptionsStep = () => {
    const newUniqueValues: Record<string, string[]> = {};
    const newOptionMappings: Record<string, Record<string, string>> = { ...optionMappings };
    let hasOptions = false;

    headers.forEach((h, i) => {
      const mapTo = mapping[h];
      if (mapTo === "status" || mapTo === "priority" || mapTo === "assignee" || mapTo.startsWith("custom_")) {
        let isSelect = mapTo === "status" || mapTo === "priority" || mapTo === "assignee";
        if (mapTo.startsWith("custom_")) {
          const field = space.customFields.find(f => f.id === mapTo.replace("custom_", ""));
          if (field?.type === "select") isSelect = true;
        }

        if (isSelect) {
          const values = Array.from(new Set(data.map(row => String(row[i] || "")))).filter(Boolean);
          newUniqueValues[h] = values;
          if (!newOptionMappings[h]) newOptionMappings[h] = {};

          // Initial intelligent option mapping
          values.forEach(val => {
            if (!newOptionMappings[h][val]) {
               if (mapTo === "status") {
                 const hardcodedStatuses = [
                   { id: "todo", name: "To Do" },
                   { id: "doing", name: "Doing" },
                   { id: "done", name: "Done" }
                 ];
                 const col = hardcodedStatuses.find(c => c.name.toLowerCase() === val.toLowerCase() || c.id === val.toLowerCase());
                 if (col) newOptionMappings[h][val] = col.id;
               } else if (mapTo === "priority") {
                 if (["high", "medium", "low"].includes(val.toLowerCase())) newOptionMappings[h][val] = val.toLowerCase();
               } else if (mapTo === "assignee") {
                 const user = users.find(u => u.name.toLowerCase() === val.toLowerCase() || u.email.toLowerCase() === val.toLowerCase());
                 if (user) newOptionMappings[h][val] = user.id;
               } else {
                 const fieldId = mapTo.replace("custom_", "");
                 const field = space.customFields.find(f => f.id === fieldId);
                 const opt = field?.options?.find(o => o.toLowerCase() === val.toLowerCase());
                 if (opt) newOptionMappings[h][val] = opt;
               }
            }
          });
          hasOptions = true;
        }
      }
    });

    setUniqueValues(newUniqueValues);
    setOptionMappings(newOptionMappings);

    if (hasOptions) setStep("options");
    else setStep("preview");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Tasks from Excel</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col py-4">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 gap-4">
              <FileSpreadsheet className="size-12 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">XLSX, XLS or CSV</p>
              </div>
              <Input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                id="excel-upload"
                onChange={handleFileUpload}
              />
              <Button asChild variant="outline">
                <label htmlFor="excel-upload" className="cursor-pointer">Select File</label>
              </Button>
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                <AlertCircle className="size-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Match the columns from your file to the fields in SyncDuo. Extra columns can be imported as new custom fields.
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="grid grid-cols-[1fr_1fr_auto] gap-x-4 gap-y-4 pr-4">
                  <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Excel Column</div>
                  <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">SyncDuo Field</div>
                  <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</div>

                  {headers.map((header) => (
                    <React.Fragment key={header}>
                      <div className="flex items-center text-sm font-medium">{header}</div>
                      <Select
                        value={mapping[header]}
                        onValueChange={(val) => handleMappingChange(header, val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">-- Skip --</SelectItem>
                          <SelectItem value="extra">-- Create as New Custom Field --</SelectItem>
                          <Separator className="my-1" />
                          {STANDARD_FIELDS.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.label} {f.required ? "*" : ""}</SelectItem>
                          ))}
                          <Separator className="my-1" />
                          {space.customFields.map(f => (
                            <SelectItem key={f.id} value={`custom_${f.id}`}>Custom: {f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {mapping[header] === "extra" ? (
                        <Select value={extraFieldTypes[header]} onValueChange={(v) => setExtraFieldTypes(prev => ({ ...prev, [header]: v }))}>
                          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <div />}
                    </React.Fragment>
                  ))}
                </div>
              </ScrollArea>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Constant Fields</h4>
                  <Button variant="outline" size="sm" onClick={() => setConstantMappings(prev => [...prev, { id: uid(), field: STANDARD_FIELDS[0].id, type: 'constant', value: '' }])}>
                    <Plus className="size-4 mr-1" /> Add Constant
                  </Button>
                </div>
                {constantMappings.length > 0 && (
                  <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-4 gap-y-2">
                    <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Field</div>
                    <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Type</div>
                    <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Value</div>
                    <div></div>

                    {constantMappings.map((c, idx) => {
                      const isDate = c.field === "dueDate" || space.customFields.find(f => `custom_${f.id}` === c.field)?.type === "date";
                      return (
                        <React.Fragment key={c.id}>
                          <Select
                            value={c.field}
                            onValueChange={(val) => {
                              const newMappings = [...constantMappings];
                              newMappings[idx].field = val;
                              if (val !== "dueDate" && space.customFields.find(f => `custom_${f.id}` === val)?.type !== "date") {
                                newMappings[idx].type = "constant";
                              }
                              setConstantMappings(newMappings);
                            }}
                          >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STANDARD_FIELDS.map(f => (
                                <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                              ))}
                              <Separator className="my-1" />
                              {space.customFields.map(f => (
                                <SelectItem key={f.id} value={`custom_${f.id}`}>Custom: {f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {isDate ? (
                            <Select value={c.type} onValueChange={(val: any) => {
                              const newMappings = [...constantMappings];
                              newMappings[idx].type = val;
                              setConstantMappings(newMappings);
                            }}>
                              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="constant">Constant</SelectItem>
                                <SelectItem value="date_plus_rowid">Base + Row ID</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="w-32" /> // placeholder
                          )}

                          {(() => {
                            if (c.field === "status") {
                              return (
                                <Select
                                  value={c.value}
                                  onValueChange={(val) => {
                                    const newMappings = [...constantMappings];
                                    newMappings[idx].value = val;
                                    setConstantMappings(newMappings);
                                  }}
                                >
                                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Status" /></SelectTrigger>
                                  <SelectContent>
                                    {[
                                      { id: "todo", name: "To Do" },
                                      { id: "doing", name: "Doing" },
                                      { id: "done", name: "Done" }
                                    ].map(col => (
                                      <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            if (c.field === "assignee") {
                              return (
                                <Select
                                  value={c.value}
                                  onValueChange={(val) => {
                                    const newMappings = [...constantMappings];
                                    newMappings[idx].value = val;
                                    setConstantMappings(newMappings);
                                  }}
                                >
                                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Assignee" /></SelectTrigger>
                                  <SelectContent>
                                    {users.map(u => (
                                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            if (c.field === "priority") {
                              return (
                                <Select
                                  value={c.value}
                                  onValueChange={(val) => {
                                    const newMappings = [...constantMappings];
                                    newMappings[idx].value = val;
                                    setConstantMappings(newMappings);
                                  }}
                                >
                                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Priority" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                  </SelectContent>
                                </Select>
                              );
                            }
                            const customField = space.customFields.find(f => `custom_${f.id}` === c.field);
                            if (customField?.type === "select") {
                              return (
                                <Select
                                  value={c.value}
                                  onValueChange={(val) => {
                                    const newMappings = [...constantMappings];
                                    newMappings[idx].value = val;
                                    setConstantMappings(newMappings);
                                  }}
                                >
                                  <SelectTrigger className="w-full"><SelectValue placeholder="Select Option" /></SelectTrigger>
                                  <SelectContent>
                                    {customField.options?.map(opt => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            return (
                              <Input
                                placeholder={isDate && c.type === 'date_plus_rowid' ? "Base Date (e.g., 2024-01-01)" : "Value"}
                                value={c.value}
                                onChange={(e) => {
                                  const newMappings = [...constantMappings];
                                  newMappings[idx].value = e.target.value;
                                  setConstantMappings(newMappings);
                                }}
                              />
                            );
                          })()}

                          <Button variant="ghost" size="icon" onClick={() => {
                            setConstantMappings(prev => prev.filter(m => m.id !== c.id));
                          }}>
                            <X className="size-4" />
                          </Button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="ghost" onClick={() => setStep("upload")}>Back</Button>
                <Button onClick={prepareOptionsStep}>Next</Button>
              </div>
            </div>
          )}

          {step === "options" && (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                <AlertCircle className="size-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Map values from your Excel columns to the available options in SyncDuo.
                </p>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-6 pr-4">
                  {Object.entries(uniqueValues).map(([header, values]) => {
                    const mapTo = mapping[header];
                    let options: { id: string; name: string }[] = [];
                    if (mapTo === "status") options = [
                      { id: "todo", name: "To Do" },
                      { id: "doing", name: "Doing" },
                      { id: "done", name: "Done" }
                    ];
                    else if (mapTo === "priority") options = [{ id: "high", name: "High" }, { id: "medium", name: "Medium" }, { id: "low", name: "Low" }];
                    else if (mapTo === "assignee") options = users.map(u => ({ id: u.id, name: u.name }));
                    else {
                      const field = space.customFields.find(f => f.id === mapTo.replace("custom_", ""));
                      options = (field?.options || []).map(o => ({ id: o, name: o }));
                    }

                    return (
                      <div key={header} className="space-y-2">
                        <h4 className="text-sm font-semibold border-b pb-1">Column: {header}</h4>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                           <div className="text-[10px] uppercase text-muted-foreground font-bold">Excel Value</div>
                           <div className="text-[10px] uppercase text-muted-foreground font-bold">SyncDuo Option</div>
                           {values.map(val => (
                             <React.Fragment key={val}>
                               <div className="text-sm italic">{val}</div>
                               <Select
                                 value={optionMappings[header]?.[val]}
                                 onValueChange={(v) => setOptionMappings(prev => ({
                                   ...prev,
                                   [header]: { ...prev[header], [val]: v }
                                 }))}
                               >
                                 <SelectTrigger className="h-8">
                                   <SelectValue placeholder="Select option..." />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {options.map(opt => (
                                     <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             </React.Fragment>
                           ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={() => setStep("mapping")}>Back</Button>
                <Button onClick={() => setStep("preview")}>Preview Data</Button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="flex flex-col flex-1 overflow-hidden space-y-4">
               <div className="flex-1 overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map(h => (
                        mapping[h] !== "skip" && <TableHead key={h}>{h}</TableHead>
                      ))}
                      {constantMappings.map(c => {
                        const fieldName = STANDARD_FIELDS.find(f => f.id === c.field)?.label || space.customFields.find(f => `custom_${f.id}` === c.field)?.name || c.field;
                        return <TableHead key={c.id}>[Const] {fieldName}</TableHead>;
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h, j) => (
                          mapping[h] !== "skip" && <TableCell key={j} className="text-xs max-w-[200px] truncate">{String(row[j] || "")}</TableCell>
                        ))}
                        {constantMappings.map(c => {
                           let val = c.value;
                           if (c.type === "date_plus_rowid") {
                              const d = new Date(c.value);
                              if (!isNaN(d.getTime())) {
                                 d.setDate(d.getDate() + i);
                                 val = d.toISOString().split("T")[0];
                              }
                           }
                           return <TableCell key={c.id} className="text-xs max-w-[200px] truncate italic text-muted-foreground">{val}</TableCell>;
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[10px] text-muted-foreground">Showing first 10 rows. Total rows to import: {data.length}</p>

              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={() => setStep("mapping")}>Back</Button>
                <Button onClick={finalizeImport} disabled={importing}>
                  {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Confirm Import
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Separator({ className }: { className?: string }) {
  return <div className={`h-px bg-border ${className}`} />;
}
