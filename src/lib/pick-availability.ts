import type { Session } from './contracts';
import { activeBookings, isValidDate, isValidTime } from './domain';
import { POLICY } from './contracts';
export function pickAvailability(sessions: Session[], draft: { date: string; startTime: string; durationMin: number }, kind: 'student' | 'tutor' | 'room', id: string, ownSessionId?: string, activeCount = 1): string | undefined {
  if (!isValidDate(draft.date) || !isValidTime(draft.startTime)) return 'Choose a date and time first';
  if (!activeCount) return undefined;
  const minutes = (time: string) => Number(time.slice(0,2))*60 + Number(time.slice(3,5));
  const start = minutes(draft.startTime);
  const day = sessions.filter(session => session.id !== ownSessionId && session.date === draft.date && activeBookings(session).length);
  const matches = day.filter(session => kind === 'room' ? session.roomId === id : kind === 'tutor' ? session.tutorId === id : activeBookings(session).some(booking => booking.studentId === id));
  const overlap = matches.find(session => start < minutes(session.startTime)+session.durationMin && minutes(session.startTime) < start+draft.durationMin);
  if (overlap) {
    const end = minutes(overlap.startTime)+overlap.durationMin;
    return `Busy ${overlap.startTime}–${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;
  }
  if (kind === 'tutor') {
    const count = matches.reduce((total,session) => total+activeBookings(session).length,0);
    if (count+activeCount>POLICY.maxBookings) return `${count+activeCount}/${POLICY.maxBookings} bookings with this session`;
  }
  return undefined;
}
