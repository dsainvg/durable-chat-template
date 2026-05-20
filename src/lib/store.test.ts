import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

describe('store load error handling', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  })

  it('should return seed data when localStorage.getItem throws an error', async () => {
    const getItemMock = vi.fn().mockImplementation(() => {
      throw new Error('localStorage is disabled');
    });

    vi.stubGlobal('localStorage', {
      getItem: getItemMock,
      setItem: vi.fn(),
    });

    const store = await import('./store');

    const { result } = renderHook(() => store.useStore());

    expect(getItemMock).toHaveBeenCalled();
    expect(result.current.state.currentUserId).toBe("");
    expect(result.current.state.theme).toBe("graphite");
    expect(result.current.state.users).toEqual([]);
    expect(result.current.state.spaces).toEqual([]);
    expect(result.current.state.dms).toEqual({});
    expect(result.current.state.automations).toEqual([]);
  });
});
