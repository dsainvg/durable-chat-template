import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import CalendarView from './CalendarView';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
globalThis.fetch = vi.fn();

// Mock DndContext as testing it directly with Testing Library is very brittle due to browser limitations
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, onDragStart, onDragEnd }: any) => {
      return (
        <div data-testid="dnd-context">
          {children}
          <button
            data-testid="mock-drag-start-invalid"
            onClick={() => onDragStart({
              active: { data: { current: null } }
            })}
          >
            Trigger Drag Start Invalid
          </button>
          <button
            data-testid="mock-drag-start"
            onClick={() => onDragStart({
              active: { data: { current: { task: { id: 1, title: 'Setup Postgres Schema', due_date: '2026-05-15' } } } }
            })}
          >
            Trigger Drag Start
          </button>
          <button
            data-testid="mock-drag-end-day"
            onClick={() => onDragEnd({
              active: { data: { current: { task: { id: 1, due_date: '2026-05-15' } } } },
              over: { id: '2026-05-25' }
            })}
          >
            Trigger Drag End Day
          </button>
          <button
            data-testid="mock-drag-end-task"
            onClick={() => onDragEnd({
              active: { data: { current: { task: { id: 1, due_date: '2026-05-15' } } } },
              over: { id: 'cal-task-2' }
            })}
          >
            Trigger Drag End Task
          </button>
          <button
            data-testid="mock-drag-end-task-invalid"
            onClick={() => onDragEnd({
              active: { data: { current: { task: { id: 1, due_date: '2026-05-15' } } } },
              over: { id: 'cal-task-99' }
            })}
          >
            Trigger Drag End Task Invalid
          </button>
          <button
            data-testid="mock-drag-end-null"
            onClick={() => onDragEnd({
              active: { data: { current: { task: { id: 1, due_date: '2026-05-15' } } } },
              over: null
            })}
          >
            Trigger Drag End Null
          </button>

          <button
            data-testid="mock-drag-opacity"
            onClick={() => onDragStart({
              active: { data: { current: { task: { id: 2, title: 'Test Opacity', due_date: '2026-05-18' } } } }
            })}
          >
            Trigger Drag Opacity
          </button>
          <button
            data-testid="mock-drag-end-same-date"
            onClick={() => onDragEnd({
              active: { data: { current: { task: { id: 1, due_date: '2026-05-15' } } } },
              over: { id: '2026-05-15' }
            })}
          >
            Trigger Drag End Same Date
          </button>
        </div>
      );
    },
    // We mock DragOverlay because it behaves strangely in tests without a real browser
    DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
    useSortable: vi.fn(() => ({ attributes: {}, listeners: {}, setNodeRef: vi.fn(), transform: null, transition: undefined, isDragging: false }))
  };
});


vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual('@dnd-kit/sortable');
  return {
    ...actual,
    useSortable: (props: any) => {
      return {
        attributes: {},
        listeners: {},
        setNodeRef: () => {},
        transform: null,
        transition: undefined,
        // make task 3 dragging
        isDragging: props.id === 'cal-task-3'
      };
    }
  };
});

describe('CalendarView', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorageMock.setItem('token', 'test-token');

    // Default fetch mock to return success
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: 1, title: 'Setup Postgres Schema', status: 'Done', task_type: 'Task', due_date: '2026-05-15', start: 1, duration: 1, space_id: 1 },
        { id: 2, title: 'Implement Next.js Views', status: 'In Progress', task_type: 'Task', due_date: '2026-05-18', start: 1, duration: 1, space_id: 1 },
        { id: 3, title: 'Configure MCP Server', status: 'To Do', task_type: 'Task', due_date: '2026-05-20', start: 1, duration: 1, space_id: 1 }
      ])
    });

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders the current month and days of week', () => {
    render(<CalendarView />);

    expect(screen.getByText('May 2026')).toBeInTheDocument();

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (const day of daysOfWeek) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it('renders mock tasks initially', () => {
    render(<CalendarView />);

    expect(screen.getByText('Setup Postgres Schema')).toBeInTheDocument();
    expect(screen.getByText('Implement Next.js Views')).toBeInTheDocument();
    expect(screen.getByText('Configure MCP Server')).toBeInTheDocument();
  });

  it('shows DragOverlay with task title on drag start', async () => {
    render(<CalendarView />);

    // Trigger mock drag start
    const btn = screen.getByTestId('mock-drag-start');
    act(() => {
      btn.click();
    });

    // Check if the overlay renders the task title.
    // Since we mocked DragOverlay, we can check inside it
    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay).toHaveTextContent('Setup Postgres Schema');
  });

  it('does nothing when dragging invalid data', async () => {
    render(<CalendarView />);

    // Trigger mock drag start
    const btn = screen.getByTestId('mock-drag-start-invalid');
    act(() => {
      btn.click();
    });

    const overlay = screen.getByTestId('drag-overlay');
    expect(overlay).toBeEmptyDOMElement();
  });

  it('updates task due_date and calls fetch on drag end (dropped on day)', async () => {
    render(<CalendarView />);

    // Trigger mock drag end
    const btn = screen.getByTestId('mock-drag-end-day');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/1', expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ due_date: '2026-05-25' })
      }));
    });
  });

  it('updates task due_date and calls fetch on drag end (dropped on another task)', async () => {
    render(<CalendarView />);

    // Trigger mock drag end
    const btn = screen.getByTestId('mock-drag-end-task');
    act(() => {
      btn.click();
    });

    // Should adopt task 2's due_date (2026-05-18)
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/1', expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ due_date: '2026-05-18' })
      }));
    });
  });

  it('does not update due_date when dropped on invalid task', async () => {
    render(<CalendarView />);

    // Trigger mock drag end
    const btn = screen.getByTestId('mock-drag-end-task-invalid');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  it('does nothing when dropping outside (over is null)', async () => {
    render(<CalendarView />);

    // Trigger mock drag end
    const btn = screen.getByTestId('mock-drag-end-null');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  it('handles fetch error gracefully', async () => {
    (globalThis.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<CalendarView />);

    const btn = screen.getByTestId('mock-drag-end-day');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });
  it('does not update when dropped on the same date', async () => {
    render(<CalendarView />);

    // Task 1 is originally on 2026-05-15
    const btn = screen.getByTestId('mock-drag-end-same-date');
    act(() => {
      btn.click();
    });

    await waitFor(() => {
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

});