import { describe, expect, it } from 'vitest';
import type { Booking, Session } from '../src/lib/contracts';
import { detectWarnings, isAfterCutoff, isValidDate, isValidTime, validateSession } from '../src/lib/domain';

function booking(id: string, status: Booking['status'] = 'booked'): Booking {
  return { id: `b-${id}`, studentId: id, studentName: id, status, cancelledAt: null, reason: null, sourceLessonId: `L-${id}`, sourceNote: null };
}
function session(id: string, patch: Partial<Session> = {}): Session {
  return { id, date: '2026-03-04', startTime: '09:00', durationMin: 60, tutorId: `t-${id}`, tutorName: `Tutor ${id}`, roomId: `r-${id}`, mode: 'one_to_one', version: 1, bookings: [booking(id)], ...patch };
}
const codes = (sessions: Session[]) => detectWarnings(sessions).map((warning) => warning.code);
const day = (count: number) => Array.from({ length: count }, (_, index) => session(`s${index}`, { tutorId: 'T1', startTime: `${String(9 + index).padStart(2, '0')}:00` }));

describe('resource occupancy and half-open intervals', () => {
  it('allows back-to-back sessions for all shared resources', () => {
    const left = session('a');
    const right = session('b', { startTime: '10:00', tutorId: left.tutorId, roomId: left.roomId, bookings: [booking('a')] });
    expect(detectWarnings([left, right])).toEqual([]);
  });
  it('identifies student, room and tutor collisions with source IDs', () => {
    const left = session('a');
    const right = session('b', { startTime: '09:30', tutorId: left.tutorId, roomId: left.roomId, bookings: [booking('a')] });
    expect(codes([left, right])).toEqual(expect.arrayContaining(['STUDENT_OVERLAP', 'TUTOR_OVERLAP', 'ROOM_OVERLAP']));
    expect(detectWarnings([left, right])[0].sessionIds).toEqual(['a', 'b']);
    expect(detectWarnings([left, right])[0].sourceLessonIds).toContain('L-a');
  });
  it('detects a contained interval and ignores another date', () => {
    const left = session('a', { durationMin: 90 });
    const right = session('b', { startTime: '09:15', tutorId: left.tutorId });
    expect(codes([left, right])).toContain('TUTOR_OVERLAP');
    expect(detectWarnings([left, { ...right, date: '2026-03-05' }])).toEqual([]);
  });
  it('ignores cancelled bookings but no-show retains resources', () => {
    const cancelled = session('a', { bookings: [booking('a', 'cancelled')] });
    const next = session('b', { tutorId: cancelled.tutorId, roomId: cancelled.roomId, bookings: [booking('a')] });
    expect(detectWarnings([cancelled, next])).toEqual([]);
    expect(codes([{ ...cancelled, bookings: [booking('a', 'no_show')] }, next])).toContain('STUDENT_OVERLAP');
  });
  it('models a pair without self-collisions; first cancellation retains shared occupancy', () => {
    const pair = session('pair', { mode: 'pair', bookings: [booking('a'), booking('b')] });
    expect(detectWarnings([pair])).toEqual([]);
    const next = session('next', { tutorId: pair.tutorId, roomId: pair.roomId });
    const firstCancelled = { ...pair, bookings: [booking('a', 'cancelled'), booking('b')] };
    expect(codes([firstCancelled, next])).toContain('TUTOR_OVERLAP');
    expect(detectWarnings([{ ...pair, bookings: [booking('a', 'cancelled'), booking('b', 'cancelled')] }, next])).toEqual([]);
  });
});

describe('daily load and affected-session validation', () => {
  it('allows six bookings and rejects seven, without counting cancelled bookings', () => {
    expect(detectWarnings(day(6))).toEqual([]);
    expect(codes(day(7))).toContain('TUTOR_DAILY_LIMIT');
    const seven = day(7);
    seven[0].bookings[0].status = 'cancelled';
    expect(detectWarnings(seven)).toEqual([]);
  });
  it('counts pair students individually and no-show toward load', () => {
    const six = day(6);
    six[0].mode = 'pair';
    six[0].bookings.push(booking('extra', 'no_show'));
    expect(codes(six)).toContain('TUTOR_DAILY_LIMIT');
  });
  it('rejects a room-only edit on an overloaded target tutor/day and counts candidate once', () => {
    const seven = day(7);
    const candidate = { ...seven[0], roomId: 'new-room' };
    expect(validateSession(candidate, seven.slice(1)).map((warning) => warning.code)).toEqual(['TUTOR_DAILY_LIMIT']);
    expect(validateSession(candidate, day(6))).toEqual([]);
  });
  it('does not block a valid candidate on unrelated invalid historical sessions', () => {
    const monday = session('old', { date: '2026-03-09' });
    expect(validateSession(session('new'), [...day(7), monday])).toEqual([]);
  });
  it('evaluates the target day/tutor when moving away from invalid history', () => {
    const seven = day(7);
    expect(validateSession({ ...seven[0], date: '2026-03-05' }, seven.slice(1))).toEqual([]);
    expect(validateSession({ ...seven[0], tutorId: 'T2' }, seven.slice(1))).toEqual([]);
  });
});

describe('calendar and operating policy', () => {
  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-3-04', 'garbage', '0000-01-01'])('rejects invalid date %s', (date) => {
    expect(isValidDate(date)).toBe(false);
    expect(codes([session('a', { date })])).toContain('INVALID_DATE');
  });
  it('accepts actual leap days', () => expect(isValidDate('2028-02-29')).toBe(true));
  it.each(['24:00', '9:00', '12:60', '10:00:00'])('rejects malformed time %s', (time) => expect(isValidTime(time)).toBe(false));
  it('checks Monday and supported duration', () => {
    expect(codes([session('a', { date: '2026-03-09', durationMin: 30 })])).toEqual(expect.arrayContaining(['CLOSED_DAY', 'INVALID_DURATION']));
  });
  it('accepts exact opening/closing boundaries and rejects crossing them', () => {
    expect(detectWarnings([session('a', { startTime: '09:00' })])).toEqual([]);
    expect(detectWarnings([session('a', { startTime: '20:30', durationMin: 90 })])).toEqual([]);
    expect(codes([session('a', { startTime: '08:59' })])).toContain('OUTSIDE_HOURS');
    expect(codes([session('a', { startTime: '21:01' })])).toContain('OUTSIDE_HOURS');
    expect(codes([session('a', { startTime: '23:30' })])).toContain('OUTSIDE_HOURS');
  });
});

describe('cutoff in the centre timezone', () => {
  it('uses the exact inclusive 16:00 boundary on the preceding day', () => {
    expect(isAfterCutoff('2026-03-03T15:59:59+07:00', null, '2026-03-04')).toBe(false);
    expect(isAfterCutoff('2026-03-03T16:00:00+07:00', null, '2026-03-04')).toBe(true);
    expect(isAfterCutoff('2026-03-03T16:00:01+07:00', null, '2026-03-04')).toBe(true);
    expect(isAfterCutoff('2026-03-03T09:00:00Z', null, '2026-03-04')).toBe(true);
  });
  it('checks old and new dates for moves, regardless of direction', () => {
    const now = '2026-03-03T17:00:00+07:00';
    expect(isAfterCutoff(now, '2026-03-04', '2026-03-05')).toBe(true);
    expect(isAfterCutoff(now, '2026-03-05', '2026-03-04')).toBe(true);
    expect(isAfterCutoff(now, '2026-03-05', '2026-03-06')).toBe(false);
  });
  it('handles year and month boundaries', () => {
    expect(isAfterCutoff('2025-12-31T16:00:00+07:00', null, '2026-01-01')).toBe(true);
    expect(isAfterCutoff('2026-02-28T15:59:59+07:00', null, '2026-03-01')).toBe(false);
  });
  it('rejects missing timezone and impossible dates', () => {
    expect(() => isAfterCutoff('2026-03-03T17:00:00', null, '2026-03-04')).toThrow(RangeError);
    expect(() => isAfterCutoff('2026-02-30T17:00:00Z', null, '2026-03-04')).toThrow(RangeError);
    expect(() => isAfterCutoff('2026-03-03T17:00:00Z', null, '2026-02-30')).toThrow(RangeError);
  });
});
