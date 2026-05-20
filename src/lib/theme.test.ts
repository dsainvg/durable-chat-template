import { describe, it, expect, vi, afterEach } from 'vitest';
import { applyTheme } from './theme';

describe('applyTheme', () => {
  afterEach(() => {
    // Clean up document after each test
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('should set data-theme attribute on document.documentElement when document is defined', () => {
    applyTheme('midnight');
    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight');

    applyTheme('crimson');
    expect(document.documentElement.getAttribute('data-theme')).toBe('crimson');
  });

  it('should not throw an error when document is undefined', () => {
    // Save original document
    const originalDocument = global.document;

    // Create a scenario where document is not defined by temporarily overriding globalThis
    const originalTypeof = typeof document;

    try {
      // @ts-ignore
      delete global.document;

      expect(() => applyTheme('graphite')).not.toThrow();
    } finally {
      // Restore document
      global.document = originalDocument;
    }
  });
});
