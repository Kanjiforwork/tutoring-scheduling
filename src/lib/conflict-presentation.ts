import { POLICY, type Session, type Warning } from './contracts';

export interface ConflictPresentation {
  title: string;
  action: string;
  slots: { date: string; startTime: string; durationMin: number; room: string; draft: boolean }[];
}

export function presentConflict(warning: Warning, sessions: Session[], candidateId?: string): ConflictPresentation {
  const related = sessions.filter(s => warning.sessionIds.includes(s.id));
  const first = related[0];
  if (!first) return { title: warning.message, action: '', slots: [] };
  const student = related.flatMap(s => s.bookings).find(b => warning.bookingIds.includes(b.id));
  const slots = related.map(s => ({ date: s.date, startTime: s.startTime, durationMin: s.durationMin, room: s.roomId, draft: s.id === candidateId }));
  switch (warning.code) {
    case 'STUDENT_OVERLAP': return {title: `${student?.studentName ?? 'Student'} has another lesson`, action: 'Choose a different time.', slots};
    case 'TUTOR_OVERLAP': return {title: `${first?.tutorName ?? 'Tutor'} is already teaching`, action: 'Choose another tutor or time.', slots};
    case 'ROOM_OVERLAP': return {title: `Room ${first?.roomId ?? ''} is already booked`, action: 'Choose another room or time.', slots};
    case 'CLOSED_DAY': return {title: 'The centre is closed on Monday', action: 'Choose Tuesday–Sunday.', slots};
    case 'OUTSIDE_HOURS': return {title: 'Outside opening hours', action: `Keep the whole lesson within ${POLICY.opensAt}–${POLICY.closesAt}.`, slots};
    case 'TUTOR_DAILY_LIMIT': {
      const count = related.reduce((total,s) => total + s.bookings.filter(b => b.status !== 'cancelled').length, 0);
      const proposed = related.some(s => s.id === candidateId);
      return {title: `${first?.tutorName ?? 'Tutor'}: ${count}/${POLICY.maxBookings} bookings${proposed ? ' after this change' : ''}`, action: `Choose another tutor/day or reduce by ${Math.max(1,count - POLICY.maxBookings)} booking(s).`, slots: []};
    }
    case 'INVALID_DATE': return {title: 'Invalid date', action: 'Choose a real calendar date.', slots: []};
    case 'INVALID_TIME': return {title: 'Invalid start time', action: 'Enter a valid time.', slots: []};
    case 'INVALID_DURATION': return {title: 'Unsupported duration', action: 'Choose 60 or 90 minutes.', slots: []};
    default: return {title: warning.message, action: '', slots: []};
  }
}
