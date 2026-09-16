import { describe, expect, it } from 'vitest';
import { afterDraftChange, errorMessages } from '../src/lib/form-feedback';
import { detectWarnings, validateSession } from '../src/lib/domain';
import type { ApiError, Session } from '../src/lib/contracts';

function session(id: string, hour = 9): Session {
  return { id, date: '2026-03-04', startTime: `${String(hour).padStart(2, '0')}:00`, durationMin: 60, tutorId: 'T1', tutorName: 'Pham Duc', roomId: 'R2', mode: 'one_to_one', version: 1,
    bookings: [{ id: `booking-${id}`, studentId: id, studentName: `Student ${hour}`, status: 'booked', cancelledAt: null, reason: null, sourceLessonId: null, sourceNote: null }] };
}
describe('session form feedback', () => {
  it('shows the primary conflict once while retaining other conflicts', () => {
    const conflicts = validateSession(session('draft'), [session('existing')]);
    const error: ApiError = { code: 'SCHEDULE_CONFLICT', message: conflicts[0].message, conflicts };
    expect(errorMessages(error)).toHaveLength(conflicts.length);
    expect(errorMessages(error).filter(message => message === error.message)).toHaveLength(1);
  });
  it('clears draft validation but preserves recovery-required errors', () => {
    expect(afterDraftChange({ code: 'SCHEDULE_CONFLICT', message: 'Old student conflict' })).toBeNull();
    expect(afterDraftChange({ code: 'INVALID_INPUT', message: 'Invalid date' })).toBeNull();
    for (const code of ['UNKNOWN_OUTCOME', 'STALE_VERSION', 'NOT_FOUND']) {
      const error = { code, message: 'Reload required' };
      expect(afterDraftChange(error)).toBe(error);
    }
  });
  it('uses readable labels for draft and stored sessions without exposing internal IDs', () => {
    const draft = session('4d622382-39fb-4acf-9a81-8b373eb404c4');
    const stored = session('stored-internal-id');
    const messages = validateSession(draft, [stored]).map(w => w.message).join(' ');
    expect(messages).toContain('This session');
    expect(messages).toContain('Student 9');
    expect(messages).not.toContain(draft.id);
    expect(messages).not.toContain(stored.id);
  });
  it('distinguishes proposed load from saved load and reports the full excess', () => {
    const existing = Array.from({ length: 6 }, (_, i) => session(`saved-${i}`, 10 + i));
    const pair = session('draft', 16);
    pair.mode = 'pair';
    pair.bookings.push({ ...pair.bookings[0], id: 'second', studentId: 'second' });
    const warning = validateSession(pair, existing).find(w => w.code === 'TUTOR_DAILY_LIMIT')!;
    expect(warning.message).toContain('This change would give Pham Duc 8');
    expect(warning.message).toContain('at least 2 bookings');
    const savedWarning = detectWarnings([...existing, pair]).find(w => w.code === 'TUTOR_DAILY_LIMIT')!;
    expect(savedWarning.message).toContain('Pham Duc has 8');
  });
});
