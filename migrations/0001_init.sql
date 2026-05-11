CREATE TABLE IF NOT EXISTS pass (
	id TEXT PRIMARY KEY,
	hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	title TEXT NOT NULL,
	status TEXT DEFAULT 'To Do',
	task_type TEXT DEFAULT 'Task',
	custom_task_id TEXT,
	due_date TEXT,
	start INTEGER,
	duration INTEGER
);
INSERT INTO tasks (id, title, status, task_type, custom_task_id, due_date, start, duration) VALUES
	(1, 'Setup Postgres Schema', 'Done', 'Task', 'ENG-1', '2026-05-15', 2, 4),
	(2, 'Implement Next.js Views', 'In Progress', 'Task', 'ENG-2', '2026-05-18', 6, 5),
	(3, 'Configure MCP Server', 'To Do', 'Task', 'ENG-3', '2026-05-20', 10, 3),
	(4, 'Write E2E Tests', 'To Do', 'Bug', 'ENG-4', null, 12, 4);
