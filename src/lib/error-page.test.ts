import { describe, it, expect } from 'vitest';
import { renderErrorPage } from './error-page';

describe('renderErrorPage', () => {
  it('should return a valid HTML string', () => {
    const html = renderErrorPage();

    // Check that it returns a string starting with doctype
    expect(typeof html).toBe('string');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
  });

  it('should contain the correct title and heading', () => {
    const html = renderErrorPage();

    expect(html).toContain('<title>This page didn\'t load</title>');
    expect(html).toContain('<h1>This page didn\'t load</h1>');
  });

  it('should contain the expected action buttons', () => {
    const html = renderErrorPage();

    // Check for the "Try again" reload button
    expect(html).toContain('<button class="primary" onclick="location.reload()">Try again</button>');

    // Check for the "Go home" link
    expect(html).toContain('<a class="secondary" href="/">Go home</a>');
  });
});
