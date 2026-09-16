import { describe, expect, it } from 'vitest';
import type { BookingStatus, EditInput, Session } from '../src/lib/contracts';
import { editPolicyError } from '../src/lib/edit-policy';
function fixture(status: BookingStatus): Session {
  return { id:'s', date:'2026-03-04', startTime:'09:00', durationMin:60, tutorId:'T1', tutorName:'Tutor', roomId:'R1', mode:'one_to_one', version:1, bookings:[{id:'b',studentId:'original',studentName:'Original',status,cancelledAt:status === 'cancelled' ? '2026-03-03T17:00:00+07:00' : null,reason:'tutor sick',sourceLessonId:'L017',sourceNote:'tutor sick'}] };
}
function payload(s: Session): EditInput {
  return { date:s.date,startTime:s.startTime,durationMin:60,tutorId:s.tutorId,roomId:s.roomId,mode:s.mode,expectedVersion:s.version,reason:'Correction',bookings:s.bookings.map(({id,studentId,status}) => ({id,studentId,status})) };
}
describe('stored booking edit policy', () => {
  for (const status of ['no_show','cancelled'] as const) {
    it.each([{date:'2026-03-05'},{startTime:'11:00'},{durationMin:90 as const},{tutorId:'T2'},{roomId:'R2'},{mode:'pair' as const}])(`blocks ${status} scheduling changes with the UI bookings payload: %j`, patch => {
      const s=fixture(status);
      expect(editPolicyError(s,{...payload(s),...patch})?.code).toBe('SESSION_NOT_EDITABLE');
    });
    it(`cannot bypass ${status} lock by changing status and time together`, () => {
      const s=fixture(status); const input=payload(s); input.bookings![0].status='booked';
      expect(editPolicyError(s,{...input,startTime:'11:00'})?.code).toBe('SESSION_NOT_EDITABLE');
      expect(editPolicyError(s,input)).toBeNull();
    });
    it(`permits ${status} note-only edits with or without bookings`, () => {
      const s=fixture(status);
      expect(editPolicyError(s,{...payload(s),note:'Contact family'})).toBeNull();
      expect(editPolicyError(s,{...payload(s),bookings:undefined,note:'Contact family'})).toBeNull();
    });
  }
  it.each(['booked','no_show','cancelled'] as const)('preserves student identity for %s bookings', status => {
    const s=fixture(status); const input=payload(s); input.bookings![0].studentId='replacement';
    expect(editPolicyError(s,input)?.code).toBe('BOOKING_IDENTITY');
    expect(s.bookings[0]).toMatchObject({studentId:'original',sourceLessonId:'L017',sourceNote:'tutor sick'});
  });
  it('allows ordinary rescheduling and addition of a second distinct booking', () => {
    const s=fixture('booked'); const input=payload(s);
    input.bookings!.push({studentId:'new',status:'booked'});
    expect(editPolicyError(s,{...input,mode:'pair',startTime:'11:00'})).toBeNull();
  });
});
