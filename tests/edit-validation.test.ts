import { describe, it, expect } from 'vitest';
import { editSchema } from '../src/lib/server/validation';
const base = { date: '2026-03-04', startTime: '09:00', durationMin: 60, tutorId: 'T1', roomId: 'R1', expectedVersion: 1, reason: 'Family requested correction' };
describe('booking edits', () => {
  it('accepts supported statuses with explicit booking identities', () => {
    for (const status of ['booked', 'cancelled', 'no_show']) expect(editSchema.safeParse({...base, bookings:[{id:'booking-1',studentId:'student-2',status}]}).success).toBe(true);
  });
  it('accepts a new student booking and separate reception note', () => {
    expect(editSchema.safeParse({...base,mode:'pair',note:'Bring workbook',bookings:[{id:'B1',studentId:'S1',status:'booked'},{studentId:'S2',status:'booked'}]}).success).toBe(true);
  });
  it('rejects unknown status and client source metadata', () => {
    for (const booking of [{id:'B1',studentId:'S1',status:'pending'}, {id:'B1',studentId:'S1',status:'booked',sourceNote:'replacement'}]) expect(editSchema.safeParse({...base,bookings:[booking]}).success).toBe(false);
  });
});
