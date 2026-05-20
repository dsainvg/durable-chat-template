Plan:
1. *Install the `xlsx` package if not already done.*
   - Already installed via `pnpm add xlsx`.
2. *Create the `ExcelImportDialog` component.*
   - We will write a complete `ExcelImportDialog` that takes an uploaded file, parses it, intelligently maps columns (title, description, status, assignee, priority, dueDate, startDate, custom fields), and presents a mapping confirmation interface to the user. It creates `Task` objects according to the space's configuration.
3. *Integrate the component into `src/routes/space.$spaceId.tsx`.*
   - Import `ExcelImportDialog` and add an "Import Tasks" button (maybe near Settings and New Task).
   - Implement an `importTasks(tasks: Task[])` handler to iterate over the imported tasks, post them to `/api/tasks`, and update the state locally to avoid too many redraws.
4. *Complete pre commit steps.*
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
5. *Submit the change.*
