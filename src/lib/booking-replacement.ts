import type { Booking, Session } from './contracts';

/** Keep the original identity and provenance; the replacement starts a fresh booking. */
export function replaceBooking(old: Booking, student: {id: string; name: string}, newId: string, now: string, reason: string): Booking[] {
  return [
    {...old, status:'cancelled', cancelledAt:old.cancelledAt ?? now, reason:old.status === 'cancelled' ? old.reason : reason},
    {id:newId, studentId:student.id, studentName:student.name, status:'booked', cancelledAt:null, reason:null, sourceLessonId:null, sourceNote:null},
  ];
}

/** Cancelled participants remain in details/history, rather than the active roster. */
export function currentBookings(session: Session): Booking[] {
  const active=session.bookings.filter(b=>b.status !== 'cancelled');
  return active.length ? active : session.bookings;
}
