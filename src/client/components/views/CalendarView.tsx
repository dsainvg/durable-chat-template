'use client';

import React, { useEffect, useState } from 'react';
import { Task } from '../../../shared';
import {
  DndContext,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const mockTasks: Task[] = [
  { id: 1, title: 'Setup Postgres Schema', status: 'Done', task_type: 'Task', due_date: '2026-05-15', start: 1, duration: 1, space_id: 1 },
  { id: 2, title: 'Implement Next.js Views', status: 'In Progress', task_type: 'Task', due_date: '2026-05-18', start: 1, duration: 1, space_id: 1 },
  { id: 3, title: 'Configure MCP Server', status: 'To Do', task_type: 'Task', due_date: '2026-05-20', start: 1, duration: 1, space_id: 1 },
];

function SortableCalTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `cal-task-${task.id}`,
    data: { task }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="text-xs bg-accent text-white px-1.5 py-0.5 rounded truncate cursor-grab hover:bg-accent-light touch-none"
      title={task.title}
    >
      {task.title}
    </div>
  );
}

function CalendarDay({ day, tasks, dateStr }: { day: number, tasks: Task[], dateStr: string }) {
  const { setNodeRef } = useDroppable({ id: dateStr });
  return (
    <div ref={setNodeRef} className="bg-bg-card p-2 min-h-[100px] border-r border-b border-border flex flex-col">
      <span className="text-sm text-text-muted font-medium mb-1">{day}</span>
      <SortableContext items={tasks.map(t => `cal-task-${t.id}`)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-1">
          {tasks.map(task => (
            <SortableCalTask key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function CalendarView({ refreshTrigger, activeSpaceId }: { refreshTrigger?: number, activeSpaceId?: number }) {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const handleDragStart = (event: any) => {
    const { active } = event;
    if (active.data.current?.task) {
      setActiveTask(active.data.current.task);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const overId = over.id.toString(); // could be 'cal-task-X' or '2026-05-XX'

    let newDateStr = '';
    // check if we dropped on another task
    if (overId.startsWith('cal-task-')) {
       const targetId = parseInt(overId.replace('cal-task-', ''));
       const targetTask = tasks.find(t => t.id === targetId);
       if (targetTask && targetTask.due_date) newDateStr = targetTask.due_date;
    } else {
       // we dropped on the day background
       newDateStr = overId;
    }

    if (newDateStr && newDateStr.startsWith('2026-05-') && active.data.current?.task) {
      const draggedTask = active.data.current.task;
      if (draggedTask.due_date !== newDateStr) {
        setTasks(prev => prev.map(t => t.id === draggedTask.id ? { ...t, due_date: newDateStr } : t));

        fetch(`/api/tasks/${draggedTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ due_date: newDateStr })
        }).catch(console.error);
      }
    }
  };

  return (
    <div className="bg-bg-card rounded-lg shadow border border-border flex flex-col h-full overflow-hidden text-text-main">
      <div className="p-4 border-b border-border flex justify-between items-center bg-bg-main">
        <h2 className="text-lg font-bold">May 2026</h2>
      </div>
      <div className="grid grid-cols-7 border-b border-border bg-bg-main">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-semibold text-text-muted border-r last:border-r-0 border-border">{day}</div>
        ))}
      </div>
      <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-border gap-px">
          {/* Mock empty days for offset */}
          <div className="bg-bg-card p-2 min-h-[100px]"></div>
          <div className="bg-bg-card p-2 min-h-[100px]"></div>
          <div className="bg-bg-card p-2 min-h-[100px]"></div>
          <div className="bg-bg-card p-2 min-h-[100px]"></div>
          <div className="bg-bg-card p-2 min-h-[100px]"></div>

          {days.map(day => {
            const dateStr = `2026-05-${day.toString().padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => t.due_date === dateStr);
            return <CalendarDay key={day} day={day} tasks={dayTasks} dateStr={dateStr} />;
          })}
        </div>
        <DragOverlay>
          {activeTask ? (
             <div className="text-xs bg-accent text-white px-1.5 py-0.5 rounded shadow-xl scale-110">
               {activeTask.title}
             </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
