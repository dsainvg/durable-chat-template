import { Task } from '../../../shared';

export const mockTasks: Task[] = [
  { id: 1, title: 'Setup Postgres Schema', status: 'Done', task_type: 'Task', custom_task_id: 'ENG-1', due_date: '2026-05-15', start: 1, duration: 4, space_id: 1 },
  { id: 2, title: 'Implement Next.js Views', status: 'In Progress', task_type: 'Task', custom_task_id: 'ENG-2', due_date: '2026-05-18', start: 6, duration: 5, space_id: 1 },
  { id: 3, title: 'Configure MCP Server', status: 'To Do', task_type: 'Task', custom_task_id: 'ENG-3', due_date: '2026-05-20', start: 10, duration: 3, space_id: 1 },
  { id: 4, title: 'Write E2E Tests', status: 'To Do', task_type: 'Bug', custom_task_id: 'ENG-4', due_date: '2026-05-22', start: 12, duration: 4, space_id: 1 },
];
