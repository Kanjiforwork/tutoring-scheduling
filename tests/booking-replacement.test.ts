import { expect, it } from 'vitest';
import { replaceBooking, currentBookings } from '../src/lib/booking-replacement';
import type { Booking, Session } from '../src/lib/contracts';
import { editSchema } from '../src/lib/server/validation';
const old:Booking={id:'old',studentId:'a',studentName:'A',status:'booked',cancelledAt:null,reason:null,sourceLessonId:'L1',sourceNote:'exam pair - half price'};
it('cancels original identity and gives replacement fresh metadata',()=>{
  const [cancelled,added]=replaceBooking(old,{id:'b',name:'B'},'new','2026-03-03T17:00:00+07:00','Family requested replacement');
  expect(cancelled).toMatchObject({id:'old',studentId:'a',status:'cancelled',sourceLessonId:'L1',sourceNote:old.sourceNote,reason:'Family requested replacement'});
  expect(added).toEqual({id:'new',studentId:'b',studentName:'B',status:'booked',cancelledAt:null,reason:null,sourceLessonId:null,sourceNote:null});
  expect(old.status).toBe('booked');
});
it('preserves previous cancellation details when replacing an already cancelled booking',()=>{
  const cancelled={...old,status:'cancelled' as const,cancelledAt:'2026-03-02T10:00:00+07:00',reason:'tutor sick'};
  expect(replaceBooking(cancelled,{id:'b',name:'B'},'new','2026-03-03T17:00:00+07:00','New student')[0]).toEqual(cancelled);
});
it('shows active students on the main board and retains all-cancelled sessions',()=>{
  const bookings=replaceBooking(old,{id:'b',name:'B'},'new','now','replace');
  expect(currentBookings({bookings} as Session).map(b=>b.studentId)).toEqual(['b']);
  const cancelled=bookings.map(b=>({...b,status:'cancelled' as const}));
  expect(currentBookings({bookings:cancelled} as Session)).toEqual(cancelled);
});
it('accepts UI replacement payload with retained cancelled history beyond two records',()=>{
  expect(editSchema.safeParse({date:'2026-03-04',startTime:'09:00',durationMin:60,tutorId:'t',roomId:'r',mode:'pair',expectedVersion:2,reason:'Replace student',bookings:[{id:'old',studentId:'a',status:'cancelled'},{id:'b',studentId:'b',status:'booked',replacementStudentId:'d'},{id:'c',studentId:'c',status:'booked'}]}).success).toBe(true);
});
