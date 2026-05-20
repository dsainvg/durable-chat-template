import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges basic string classes', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('handles conditional object syntax', () => {
    expect(cn('class1', { class2: true, class3: false })).toBe('class1 class2');
  });

  it('ignores falsy values and undefined inputs', () => {
    expect(cn('class1', null, undefined, false, 0, '', 'class2')).toBe('class1 class2');
  });

  it('merges tailwind classes correctly', () => {
    // twMerge overriding padding
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('px-2 py-2', 'p-4')).toBe('p-4');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('handles arrays of classes', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });
});
