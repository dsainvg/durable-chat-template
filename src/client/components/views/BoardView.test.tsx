import { render, screen, waitFor, act } from '@testing-library/react';
import BoardView from './BoardView';
import { vi, test, expect, beforeEach } from 'vitest';
import React from 'react';

// Mock dnd-kit modules to allow programmatic testing of onDragEnd
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: any) => {
      // Expose onDragEnd to the window or a global for testing
      (window as any).simulateDragEnd = (activeId: string, overId: string | null) => {
        onDragEnd({
          active: { id: activeId, data: { current: { task: { id: Number(activeId), status: 'To Do' } } } },
          over: overId ? { id: overId } : null
        });
      };
      return <div data-testid="dnd-context">{children}</div>;
    }
  };
});

global.fetch = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  delete (window as any).simulateDragEnd;
});

test('mock API error falls back to mockTasks', async () => {
  (global.fetch as any).mockImplementation(() => {
    return Promise.reject(new Error('Network error'));
  });

  render(<BoardView />);

  await waitFor(() => {
    // Setup Postgres Schema is from the mock tasks defined in the file
    expect(screen.getByText('Setup Postgres Schema')).toBeInTheDocument();
  });
});

test('renders tasks correctly grouped by status', async () => {
  (global.fetch as any).mockImplementation((url: string) => {
    if (url.includes('/api/tasks')) {
      return Promise.resolve({
        json: async () => [
          { id: 1, title: 'Task 1', status: 'To Do', task_type: 'Task', custom_task_id: 'ENG-1', start: 1, duration: 1, space_id: 1 },
          { id: 2, title: 'Task 2', status: 'In Progress', task_type: 'Bug', custom_task_id: 'ENG-2', start: 1, duration: 1, space_id: 1 }
        ]
      });
    }
    return Promise.resolve({ ok: true });
  });

  render(<BoardView />);

  await waitFor(() => {
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  const todoCol = screen.getByText('To Do').closest('div[id="To Do"]');
  expect(todoCol).toHaveTextContent('Task 1');
  expect(todoCol).not.toHaveTextContent('Task 2');

  const inProgressCol = screen.getByText('In Progress').closest('div[id="In Progress"]');
  expect(inProgressCol).toHaveTextContent('Task 2');
  expect(inProgressCol).not.toHaveTextContent('Task 1');
});

test('drag and drop triggers API call to update status', async () => {
  (global.fetch as any).mockImplementation((url: string) => {
    if (url.includes('/api/tasks')) {
      return Promise.resolve({
        json: async () => [
          { id: 1, title: 'Task 1', status: 'To Do', task_type: 'Task', custom_task_id: 'ENG-1', start: 1, duration: 1, space_id: 1 }
        ]
      });
    }
    return Promise.resolve({ ok: true });
  });

  render(<BoardView />);

  await waitFor(() => {
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  // Simulate drop over "In Progress" column
  act(() => {
    (window as any).simulateDragEnd('1', 'In Progress');
  });

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/tasks/1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ status: 'In Progress' })
    }));
  });

  // Verify UI update optimistically
  const inProgressCol = screen.getByText('In Progress').closest('div[id="In Progress"]');
  expect(inProgressCol).toHaveTextContent('Task 1');
});
