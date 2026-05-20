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
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle } from "lucide-react";

interface ExcelIntegrationProps {
  space: Space;
  users: User[];
  onImport: (tasks: Task[], newCustomFields?: { id: string; name: string; type: "text" }[]) => Promise<void>;
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

  const data = tasks.map((t) => {
    const row: Record<string, any> = {
      Title: t.title,
      Description: t.description,
      Status: space.columns.find((c) => c.id === t.status)?.name || t.status,
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
  const [step, setStep] = React.useState<"upload" | "mapping" | "preview">("upload");
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [importing, setImporting] = React.useState(false);

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
        setStep("mapping");
      }
    };
    reader.readAsBinaryString(f);
  };

  const finalizeImport = async () => {
    setImporting(true);
    try {
      const newCustomFieldsToCreate: { id: string; name: string; type: "text" }[] = [];
      const extraHeaderToId: Record<string, string> = {};

      // Prepare new custom fields IDs
      Object.entries(mapping).forEach(([header, target]) => {
        if (target === "extra") {
          const newId = uid();
          extraHeaderToId[header] = newId;
          newCustomFieldsToCreate.push({ id: newId, name: header, type: "text" });
        }
      });

      const tasksToImport: Task[] = data.map((row) => {
        const task: any = {
          id: uid(),
          title: "",
          description: "",
          status: space.columns[0]?.id || "todo",
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
            const col = space.columns.find(c => c.name.toLowerCase() === String(val).toLowerCase() || c.id === String(val));
            task.status = col ? col.id : space.columns[0]?.id || "todo";
          }
          else if (mapTo === "assignee") {
            const user = users.find(u => u.name.toLowerCase() === String(val).toLowerCase() || u.email.toLowerCase() === String(val).toLowerCase() || u.id === String(val));
            task.assignee = user ? user.id : "";
          }
          else if (mapTo === "dueDate") {
            try {
              if (typeof val === 'number') {
                const d = XLSX.SSF.parse_date_code(val);
                task.dueDate = new Date(d.y, d.m - 1, d.d).toISOString();
              } else {
                task.dueDate = new Date(val).toISOString();
              }
            } catch {
              task.dueDate = "";
            }
          }
          else if (mapTo === "priority") {
            const p = String(val).toLowerCase();
            if (["high", "medium", "low"].includes(p)) task.priority = p;
            else task.priority = "medium";
          }
          else if (mapTo.startsWith("custom_")) {
            const fieldId = mapTo.replace("custom_", "");
            task.custom[fieldId] = String(val);
          }
          else if (mapTo === "extra") {
            const newId = extraHeaderToId[h];
            if (newId) task.custom[newId] = String(val);
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
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 pr-4">
                  <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Excel Column</div>
                  <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">SyncDuo Field</div>

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
                    </React.Fragment>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between items-center pt-4">
                <Button variant="ghost" onClick={() => setStep("upload")}>Back</Button>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 10).map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h, j) => (
                          mapping[h] !== "skip" && <TableCell key={j} className="text-xs max-w-[200px] truncate">{String(row[j] || "")}</TableCell>
                        ))}
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
