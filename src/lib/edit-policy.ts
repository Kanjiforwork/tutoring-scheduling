import type { EditInput, Session } from './contracts';

export function scheduleLocked(session: Session): boolean {
  return session.bookings.every(b => b.status === 'cancelled') || session.bookings.some(b => b.status === 'no_show');
}

/** Evaluate the stored state, never the presence of optional UI payload fields. */
export function editPolicyError(before: Session, input: EditInput): { code: string; message: string } | null {
  const moved = (['date', 'startTime', 'durationMin', 'tutorId', 'roomId'] as const).some(key => before[key] !== input[key]) || (input.mode !== undefined && before.mode !== input.mode);
  if (moved && scheduleLocked(before)) return { code: 'SESSION_NOT_EDITABLE', message: 'Fully cancelled sessions and sessions with a no-show cannot be rescheduled. Correct the booking status separately before arranging a new time.' };
  if (input.bookings?.some(edit => {
    const old = before.bookings.find(b => b.id === edit.id);
    return old && old.studentId !== edit.studentId;
  })) return { code: 'BOOKING_IDENTITY', message: 'An existing booking keeps its student identity. Use replacementStudentId to replace the student while preserving history.' };
  return null;
}
