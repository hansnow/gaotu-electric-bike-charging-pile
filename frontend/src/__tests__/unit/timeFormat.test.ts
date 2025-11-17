import { describe, expect, it } from 'vitest';
import { formatDurationFromMs, toDateInputValue } from '@/utils/timeFormat';

describe('timeFormat helpers', () => {
  it('formats duration as hh:mm', () => {
    expect(formatDurationFromMs(90 * 60 * 1000)).toBe('01:30');
  });

  it('returns placeholder for negative values', () => {
    expect(formatDurationFromMs(-1)).toBe('--');
  });

  it('normalizes date values', () => {
    expect(toDateInputValue('2024-01-01')).toBe('2024-01-01');
    expect(toDateInputValue(null)).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
