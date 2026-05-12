'use client';

import React, { useEffect, useState } from 'react';
import { Task, TaskStatus } from '../../../shared';
import {
  DndContext,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { mockTasks } from './mockTasks';

function DroppableColumn({ id, children }: { id: string, children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="flex flex-col gap-3 flex-1 min-h-[100px]">
      {children}
    </div>
  );
}

function SortableTask({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id.toString(), data: { task } });

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
      className="bg-bg-card p-3 rounded shadow-sm border border-border cursor-grab hover:shadow-md transition-shadow touch-none"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-text-muted">{task.custom_task_id}</span>
        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${task.task_type === 'Bug' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
          {task.task_type}
        </span>
      </div>
      <p className="text-sm font-medium text-text-main">{task.title}</p>
    </div>
  );
}

export default function BoardView({ refreshTrigger, activeSpaceId }: { refreshTrigger?: number, activeSpaceId?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

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

  const statuses: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

  const handleDragStart = (event: any) => {
    const { active } = event;
    const task = tasks.find(t => t.id.toString() === active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    // Is it dropping over another task or a column?
    let newStatus: TaskStatus | '' = '';
    const overId = over.id.toString();

    if (statuses.includes(overId as TaskStatus)) {
      newStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find(t => t.id.toString() === overId);
      if (overTask) newStatus = overTask.status;
    }

    if (newStatus && active.data.current?.task) {
      const updatedTask = active.data.current.task;
      if (updatedTask.status !== newStatus) {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...t, status: newStatus } : t));

        fetch(`/api/tasks/${updatedTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ status: newStatus })
        }).catch(console.error);
      }
    }
  };

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {statuses.map(status => {
          const colTasks = tasks.filter(t => t.status === status);
          return (
            <div key={status} id={status} className="w-80 min-w-[320px] bg-bg-main border border-border rounded-lg p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-text-main">{status}</h3>
                <span className="text-sm bg-gray-200 dark:bg-gray-700 text-text-muted px-2 py-1 rounded-full">
                  {colTasks.length}
                </span>
              </div>
              <SortableContext items={colTasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
                <DroppableColumn id={status}>
                  {colTasks.map((task) => (
                    <SortableTask key={task.id} task={task} />
                  ))}
                </DroppableColumn>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="bg-bg-card p-3 rounded shadow-xl border-2 border-accent cursor-grabbing transform scale-105">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-text-muted">{activeTask.custom_task_id}</span>
            </div>
            <p className="text-sm font-medium text-text-main">{activeTask.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
