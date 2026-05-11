import React from 'react';

const mockTasks = [
  { id: 1, title: 'Setup Postgres Schema', start: 2, duration: 4 },
  { id: 2, title: 'Implement Next.js Views', start: 6, duration: 5 },
  { id: 3, title: 'Configure MCP Server', start: 10, duration: 3 },
  { id: 4, title: 'Write E2E Tests', start: 12, duration: 4 },
];

export default function GanttView() {
  const days = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <div className="w-64 p-3 font-semibold border-r border-gray-200 shrink-0">Task Name</div>
          <div className="flex-1 flex">
            {days.map(day => (
              <div key={day} className="flex-1 text-center text-xs text-gray-500 py-3 border-r border-gray-200 last:border-r-0">
                May {day}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div>
          {mockTasks.map(task => (
            <div key={task.id} className="flex border-b border-gray-100 hover:bg-gray-50">
              <div className="w-64 p-3 text-sm font-medium text-gray-800 border-r border-gray-200 shrink-0 truncate">
                {task.title}
              </div>
              <div className="flex-1 relative bg-gray-50/50">
                {/* Background grid */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map(day => (
                    <div key={day} className="flex-1 border-r border-gray-200 last:border-r-0"></div>
                  ))}
                </div>
                {/* Task Bar */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-6 bg-accent rounded-sm shadow-sm opacity-90 cursor-pointer hover:opacity-100 transition-opacity flex items-center justify-between px-1"
                  style={{
                    left: `${(task.start / 20) * 100}%`,
                    width: `${(task.duration / 20) * 100}%`
                  }}
                  title={`${task.title} (${task.duration} days)`}
                >
                   {/* Left resize handle */}
                   <div className="w-1.5 h-4 bg-white/50 rounded-full cursor-col-resize hover:bg-white transition-colors" />
                   {/* Right resize handle */}
                   <div className="w-1.5 h-4 bg-white/50 rounded-full cursor-col-resize hover:bg-white transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
