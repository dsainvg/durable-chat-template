import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ListView from './ListView';
import { vi } from 'vitest';

describe('ListView Component', () => {
  let globalFetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    globalFetchMock = vi.fn();
    global.fetch = globalFetchMock;
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('mock-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders tasks successfully fetched from the API', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 101, title: 'API Task 1', status: 'To Do', task_type: 'Feature', custom_task_id: 'API-1' },
      ],
    } as Response);

    render(<ListView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('API Task 1')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('To Do')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Feature')).toBeInTheDocument();
    expect(screen.getByDisplayValue('API-1')).toBeInTheDocument();
  });

  it('renders mock tasks when the API returns an empty array', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    render(<ListView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Setup Postgres Schema')).toBeInTheDocument();
    });
  });

  it('renders mock tasks when the API fails', async () => {
    globalFetchMock.mockRejectedValueOnce(new Error('Network error'));

    render(<ListView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Setup Postgres Schema')).toBeInTheDocument();
    });
  });

  it('handles input changes and calls API for task update', async () => {
    globalFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 101, title: 'API Task 1', status: 'To Do', task_type: 'Feature', custom_task_id: 'API-1' },
      ],
    } as Response);

    render(<ListView />);

    const input = await screen.findByDisplayValue('API Task 1');

    // Changing the value and blurring to trigger API call
    fireEvent.change(input, { target: { value: 'Updated Task 1' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(globalFetchMock).toHaveBeenCalledWith('/api/tasks/101', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated Task 1' })
      }));
    });
  });
});
