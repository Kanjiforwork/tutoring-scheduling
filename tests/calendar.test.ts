import { describe, expect, it } from 'vitest';
import { monthBounds, monthDates, shiftMonth, weekDates } from '../src/lib/calendar';

describe('calendar navigation', () => {
  it('keeps seven Monday-first days across a year boundary', () => {
    expect(weekDates('2026-01-01')).toEqual(['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
    expect(weekDates('2026-03-08')[0]).toBe('2026-03-02');
  });
  it('clamps the selected day when moving into a shorter month', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2024-03-31', -1)).toBe('2024-02-29');
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15');
  });
  it('bounds the query to the requested month, including leap February', () => {
    expect(monthBounds('2024-02-29')).toEqual({ start: '2024-02-01', end: '2024-03-01' });
    expect(monthBounds('2026-12-31')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });
  it('includes every day once and completes calendar edge weeks', () => {
    const days = monthDates('2026-03-04');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-02-23');
    expect(days.at(-1)).toBe('2026-04-05');
    expect(days.filter(d => d.startsWith('2026-03'))).toHaveLength(31);
    expect(new Set(days).size).toBe(days.length);
    expect(monthDates('2021-02-01')).toHaveLength(28);
  });
});
