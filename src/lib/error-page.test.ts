import { describe, it, expect } from 'vitest';
import { renderErrorPage } from './error-page';

describe('renderErrorPage', () => {
  it('should return a string containing key text elements', () => {
    const html = renderErrorPage();
    expect(typeof html).toBe('string');
    expect(html).toContain("This page didn't load");
    expect(html).toContain('Try again');
    expect(html).toContain('Go home');
  });

  it('should match the snapshot', () => {
    const html = renderErrorPage();
    expect(html).toMatchSnapshot();
  });
});
