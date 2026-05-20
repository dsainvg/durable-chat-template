import * as XLSX from "xlsx";
import { type Space, type Task, type User } from "./store";

export function exportTasksToExcel(space: Space, tasks: Task[], users: User[]) {
  const data = tasks.map((task) => {
    // Resolve assignee
    const assignee = users.find((u) => u.id === task.assignee)?.name || task.assignee || "";

    // Resolve status
    const status = space.columns.find((c) => c.id === task.status)?.name || task.status || "";

    const row: Record<string, any> = {
      ID: task.id,
      Title: task.title,
      Description: task.description,
      Status: status,
      Assignee: assignee,
      "Due Date": task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "",
      "Start Date": task.startDate ? new Date(task.startDate).toLocaleDateString() : "",
      Priority: task.priority,
    };

    // Add custom fields
    space.customFields?.forEach((field) => {
      row[field.name] = task.custom?.[field.id] || "";
    });

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

  XLSX.writeFile(workbook, `${space.name}_Tasks.xlsx`);
}

export function parseExcelFile(file: File): Promise<{ headers: string[]; rows: any[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert sheet to JSON array of objects
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (json.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        // Extract headers from the first row object's keys
        const headers = Object.keys(json[0] as object);

        resolve({ headers, rows: json });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsBinaryString(file);
  });
}
