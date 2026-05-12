import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GanttView from './GanttView';

const mockTasksFromApi = [
  { id: 101, title: 'API Task 1', status: 'To Do', task_type: 'Task', start: 2, duration: 4, space_id: 1 },
  { id: 102, title: 'API Task 2', status: 'In Progress', task_type: 'Task', start: 6, duration: 5, space_id: 1 },
];

describe('GanttView Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    Storage.prototype.getItem = vi.fn(() => 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    cleanup();
  });

  it('renders timeline columns correctly', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      json: () => Promise.resolve([]),
    });

    render(<GanttView />);

    await waitFor(() => {
        expect(screen.getByText('Setup Postgres Schema')).toBeInTheDocument();
    });

    // Verify day columns 1 to 20 are rendered
    for (let i = 1; i <= 20; i++) {
      expect(screen.getByText(`May ${i}`)).toBeInTheDocument();
    }
  });

  it('fetches tasks from API and renders task rows correctly', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      json: () => Promise.resolve(mockTasksFromApi),
    });

    render(<GanttView />);

    // Wait for the tasks to be rendered
    await waitFor(() => {
      expect(screen.getByText('API Task 1')).toBeInTheDocument();
    });
    expect(screen.getByText('API Task 2')).toBeInTheDocument();

    const taskRows = screen.getAllByTestId('task-row');
    expect(taskRows).toHaveLength(2);

    // Verify correct width and positioning calculation for the first task
    // It should have left: (2 / 20) * 100% = 10%
    // and width: (4 / 20) * 100% = 20%
    const task1Bar = screen.getByTitle('API Task 1 (4 days)');
    expect(task1Bar).toHaveStyle({ left: '10%', width: '20%' });

    // Verify for the second task
    // left: (6 / 20) * 100% = 30%
    // width: (5 / 20) * 100% = 25%
    const task2Bar = screen.getByTitle('API Task 2 (5 days)');
    expect(task2Bar).toHaveStyle({ left: '30%', width: '25%' });
  });

  it('uses fallback mock tasks when API returns an empty array or errors', async () => {
    (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));

    render(<GanttView />);

    // The fallback mock tasks have Setup Postgres Schema
    await waitFor(() => {
      expect(screen.getByText('Setup Postgres Schema')).toBeInTheDocument();
    });

    const taskRows = screen.getAllByTestId('task-row');
    expect(taskRows.length).toBeGreaterThan(0);
  });
});
