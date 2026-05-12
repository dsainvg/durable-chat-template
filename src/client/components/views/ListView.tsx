import React, { useEffect, useState } from 'react';

const mockTasks = [
  { id: 1, title: 'Setup Postgres Schema', status: 'Done', task_type: 'Task', custom_task_id: 'ENG-1' },
  { id: 2, title: 'Implement Next.js Views', status: 'In Progress', task_type: 'Task', custom_task_id: 'ENG-2' },
  { id: 3, title: 'Configure MCP Server', status: 'To Do', task_type: 'Task', custom_task_id: 'ENG-3' },
  { id: 4, title: 'Write E2E Tests', status: 'To Do', task_type: 'Bug', custom_task_id: 'ENG-4' },
];

export default function ListView() {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
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
  }, []);

  return (
    <div className="bg-white shadow rounded-lg border border-gray-200">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-200 text-sm">
            <th className="p-3 font-semibold">Name</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">Type</th>
            <th className="p-3 font-semibold">Task ID</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task: any) => (
            <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="p-3">{task.title}</td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded text-xs ${task.status === 'Done' ? 'bg-green-100 text-green-800' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                  {task.status}
                </span>
              </td>
              <td className="p-3 text-sm text-gray-500">{task.task_type}</td>
              <td className="p-3 text-sm text-gray-500 font-mono">{task.custom_task_id || '-'}</td>
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
