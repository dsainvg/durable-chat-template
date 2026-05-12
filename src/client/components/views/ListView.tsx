import React, { useEffect, useState } from 'react';

const mockTasks = [
  { id: 1, title: 'Setup Postgres Schema', status: 'Done', task_type: 'Task', custom_task_id: 'ENG-1' },
  { id: 2, title: 'Implement Next.js Views', status: 'In Progress', task_type: 'Task', custom_task_id: 'ENG-2' },
  { id: 3, title: 'Configure MCP Server', status: 'To Do', task_type: 'Task', custom_task_id: 'ENG-3' },
  { id: 4, title: 'Write E2E Tests', status: 'To Do', task_type: 'Bug', custom_task_id: 'ENG-4' },
];

export default function ListView({ refreshTrigger, activeSpaceId }: { refreshTrigger?: number, activeSpaceId?: number }) {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/tasks' + (activeSpaceId ? '?space_id=' + activeSpaceId : ''), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setTasks(data);
        else setTasks(mockTasks);
      })
      .catch((e) => {
        console.log('Using mock data due to error', e);
        setTasks(mockTasks);
      });
  }, [refreshTrigger, activeSpaceId]);

  return (
    <div className="bg-[var(--bg-card)] shadow rounded-lg border border-gray-200">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[var(--bg-main)] border-b border-gray-200 text-sm">
            <th className="p-3 font-semibold">Name</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">Type</th>
            <th className="p-3 font-semibold">Task ID</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task: any) => (
            <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="p-3">
                <input
                  type="text"
                  defaultValue={task.title}
                  className="bg-transparent border-b border-transparent focus:border-[var(--accent)] focus:outline-none w-full"
                  onBlur={(e) => {
                    if (e.target.value !== task.title) {
                      fetch(`/api/tasks/${task.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify({ title: e.target.value })
                      });
                    }
                  }}
                />
              </td>
              <td className="p-3">
                <select
                  defaultValue={task.status}
                  className={`px-2 py-1 rounded text-xs focus:outline-none appearance-none ${task.status === 'Done' ? 'bg-green-100 text-green-800' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-[var(--bg-main)] text-[var(--text-main)]'}`}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    e.target.className = `px-2 py-1 rounded text-xs focus:outline-none appearance-none ${newStatus === 'Done' ? 'bg-green-100 text-green-800' : newStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-[var(--bg-main)] text-[var(--text-main)]'}`;
                    fetch(`/api/tasks/${task.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                      body: JSON.stringify({ status: newStatus })
                    });
                  }}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </td>
              <td className="p-3 text-sm text-[var(--text-muted)]">
                <select
                  defaultValue={task.task_type}
                  className="bg-transparent focus:outline-none appearance-none"
                  onChange={(e) => {
                    fetch(`/api/tasks/${task.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                      body: JSON.stringify({ task_type: e.target.value })
                    });
                  }}
                >
                  <option value="Task">Task</option>
                  <option value="Bug">Bug</option>
                  <option value="Feature">Feature</option>
                </select>
              </td>
              <td className="p-3 text-sm text-[var(--text-muted)] font-mono">
                <input
                  type="text"
                  defaultValue={task.custom_task_id || ''}
                  className="bg-transparent border-b border-transparent focus:border-[var(--accent)] focus:outline-none w-24"
                  onBlur={(e) => {
                    if (e.target.value !== task.custom_task_id) {
                      fetch(`/api/tasks/${task.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                        body: JSON.stringify({ custom_task_id: e.target.value })
                      });
                    }
                  }}
                />
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center text-gray-500">No tasks found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
