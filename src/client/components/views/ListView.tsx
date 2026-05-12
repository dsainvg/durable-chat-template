import React, { useEffect, useState } from 'react';

const mockTasks = [
  { id: 1, title: 'Setup Postgres Schema', status: 'Done', task_type: 'Task', custom_task_id: 'ENG-1' },
  { id: 2, title: 'Implement Next.js Views', status: 'In Progress', task_type: 'Task', custom_task_id: 'ENG-2' },
  { id: 3, title: 'Configure MCP Server', status: 'To Do', task_type: 'Task', custom_task_id: 'ENG-3' },
  { id: 4, title: 'Write E2E Tests', status: 'To Do', task_type: 'Bug', custom_task_id: 'ENG-4' },
];

export default function ListView() {
  const [tasks, setTasks] = useState<any[]>([]);

  const fetchTasks = () => {
    fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setTasks(data);
        else setTasks(mockTasks);
      })
      .catch((e) => {
        console.log('Using mock data due to error', e);
        setTasks(mockTasks);
      });
  };

  useEffect(() => {
    fetchTasks();
    const handleTaskAdded = () => fetchTasks();
    window.addEventListener('taskAdded', handleTaskAdded);
    return () => window.removeEventListener('taskAdded', handleTaskAdded);
  }, []);

  const handleUpdate = (id: number, field: string, value: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ [field]: value })
    }).catch(console.error);
  };

  return (
    <div className="bg-bg-card shadow rounded-lg border border-border overflow-hidden">
      <table className="w-full text-left border-collapse text-text-main">
        <thead>
          <tr className="bg-bg-main border-b border-border text-sm">
            <th className="p-3 font-semibold">Name</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">Type</th>
            <th className="p-3 font-semibold">Task ID</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task: any) => (
            <tr key={task.id} className="border-b border-border hover:bg-bg-main/50 transition-colors">
              <td className="p-3">
                <input
                  type="text"
                  defaultValue={task.title}
                  onBlur={(e) => {
                    if (e.target.value !== task.title) {
                      handleUpdate(task.id, 'title', e.target.value);
                    }
                  }}
                  className="bg-transparent border-none outline-none focus:ring-2 focus:ring-accent w-full p-1 rounded"
                />
              </td>
              <td className="p-3">
                <select
                  value={task.status}
                  onChange={(e) => handleUpdate(task.id, 'status', e.target.value)}
                  className={`px-2 py-1 rounded text-xs outline-none bg-bg-card border border-border ${task.status === 'Done' ? 'text-green-500' : task.status === 'In Progress' ? 'text-blue-500' : 'text-gray-500'}`}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </td>
              <td className="p-3 text-sm text-text-muted">
                <input
                  type="text"
                  defaultValue={task.task_type}
                  onBlur={(e) => {
                    if (e.target.value !== task.task_type) {
                      handleUpdate(task.id, 'task_type', e.target.value);
                    }
                  }}
                  className="bg-transparent border-none outline-none focus:ring-2 focus:ring-accent w-full p-1 rounded"
                />
              </td>
              <td className="p-3 text-sm text-text-muted font-mono">{task.custom_task_id || '-'}</td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center text-text-muted">No tasks found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
