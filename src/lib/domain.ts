import { presentConflict } from './conflict-presentation';
import { POLICY, type Booking, type Session, type Warning } from './contracts';

/** Strict calendar validation prevents Date from silently rolling February 30 into March. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function activeBookings(session: Session): Booking[] {
  return session.bookings.filter((booking) => booking.status === 'booked' || booking.status === 'no_show');
}

function minutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function label(session: Session, candidateId?: string): string {
  return `${session.id === candidateId ? 'This session' : activeBookings(session).map(b => b.studentName).join(' & ')} (${session.date} ${session.startTime}, ${session.roomId})`;
}

function warning(code: string, message: string, sessions: Session[], bookings = sessions.flatMap(activeBookings)): Warning {
  return {
    code,
    message,
    sessionIds: [...new Set(sessions.map((session) => session.id))],
    bookingIds: [...new Set(bookings.map((booking) => booking.id))],
    sourceLessonIds: [...new Set(bookings.flatMap((booking) => booking.sourceLessonId ? [booking.sourceLessonId] : []))],
  };
}

/** Reads never repair historical data. Cancelled-only sessions no longer consume resources. */
export function detectWarnings(sessions: Session[], candidateId?: string): Warning[] {
  const warnings: Warning[] = [];
  const active = sessions.filter((session) => activeBookings(session).length > 0);
  const validIntervals: Session[] = [];
  for (const session of active) {
    const validDate = isValidDate(session.date);
    const validTime = isValidTime(session.startTime);
    if (!validDate) warnings.push(warning('INVALID_DATE', 'Choose a valid calendar date in YYYY-MM-DD format.', [session]));
    if (!validTime) warnings.push(warning('INVALID_TIME', 'Choose a valid start time in HH:mm format.', [session]));
    if (!(POLICY.durations as readonly number[]).includes(session.durationMin)) {
      warnings.push(warning('INVALID_DURATION', `Sessions must last ${POLICY.durations.join(' or ')} minutes.`, [session]));
    }
    if (validDate && new Date(`${session.date}T00:00:00Z`).getUTCDay() === POLICY.closedWeekday) {
      warnings.push(warning('CLOSED_DAY', `${label(session, candidateId)} is on Monday, when the centre is closed. Choose Tuesday–Sunday.`, [session]));
    }
    if (validTime && Number.isFinite(session.durationMin) && session.durationMin > 0) {
      const start = minutes(session.startTime);
      if (start < minutes(POLICY.opensAt) || start + session.durationMin > minutes(POLICY.closesAt)) {
        warnings.push(warning('OUTSIDE_HOURS', `${label(session, candidateId)} must fit entirely within ${POLICY.opensAt}–${POLICY.closesAt}.`, [session]));
      }
      if (validDate) validIntervals.push(session);
    }
  }

  for (let i = 0; i < validIntervals.length; i++) {
    const left = validIntervals[i];
    for (let j = i + 1; j < validIntervals.length; j++) {
      const right = validIntervals[j];
      if (left.date !== right.date) continue;
      const leftStart = minutes(left.startTime);
      const rightStart = minutes(right.startTime);
      if (leftStart >= rightStart + right.durationMin || rightStart >= leftStart + left.durationMin) continue;
      const records = `${label(left, candidateId)} and ${label(right, candidateId)}`;
      if (left.tutorId === right.tutorId) {
        warnings.push(warning('TUTOR_OVERLAP', `${left.tutorName} is assigned to overlapping sessions: ${records}. Choose another tutor or time.`, [left, right]));
      }
      if (left.roomId === right.roomId) {
        warnings.push(warning('ROOM_OVERLAP', `${left.roomId} is occupied by overlapping sessions: ${records}. Choose another room or time.`, [left, right]));
      }
      const leftBookings = activeBookings(left);
      const rightBookings = activeBookings(right);
      for (const booking of leftBookings) {
        const match = rightBookings.find((other) => other.studentId === booking.studentId);
        if (match) warnings.push(warning('STUDENT_OVERLAP', `${booking.studentName} is double-booked: ${records}. Choose a different time.`, [left, right], [booking, match]));
      }
    }
  }

  const tutorDays = new Map<string, Session[]>();
  for (const session of active) {
    const key = `${session.date}|${session.tutorId}`;
    const group = tutorDays.get(key) ?? [];
    group.push(session);
    tutorDays.set(key, group);
  }
  for (const group of tutorDays.values()) {
    const count = group.reduce((total, session) => total + activeBookings(session).length, 0);
    if (count > POLICY.maxBookings) {
      warnings.push(warning('TUTOR_DAILY_LIMIT', `${candidateId && group.some(s => s.id === candidateId) ? 'This change would give ' + group[0].tutorName : group[0].tutorName + ' has'} ${count} active student bookings on ${group[0].date}; the limit is ${POLICY.maxBookings}. A pair counts as two. Changing only the room will not resolve this; change tutor/day or reduce the total by at least ${count - POLICY.maxBookings} booking${count - POLICY.maxBookings === 1 ? '' : 's'}.`, group));
    }
  }
  return warnings.map(item => ({ ...item, presentation: presentConflict(item, sessions, candidateId) }));
}

/** Validate only the affected session; unrelated historical violations must not block a write. */
export function validateSession(candidate: Session, otherSessions: Session[]): Warning[] {
  // Excluding by identity is defensive: callers normally already exclude the old representation.
  return detectWarnings([...otherSessions.filter((session) => session.id !== candidate.id), candidate], candidate.id)
    .filter((item) => item.sessionIds.includes(candidate.id));
}

/** The centre uses UTC+07 year-round. Either side of a move may already be past cutoff. */
export function isAfterCutoff(now: string, oldDate: string | null, newDate: string): boolean {
  const dates = oldDate === null ? [newDate] : [oldDate, newDate];
  if (dates.some((date) => !isValidDate(date))) throw new RangeError('Invalid schedule date for cutoff.');
  const timestampShape = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  if (!timestampShape.test(now) || !isValidDate(now.slice(0, 10)) || !Number.isFinite(Date.parse(now))) {
    throw new RangeError('Cutoff clock must be a valid ISO timestamp with timezone.');
  }
  const current = Date.parse(now);
  // 16:00 on the preceding local day is 8 hours before the lesson day's local midnight.
  return dates.some((date) => current >= Date.parse(`${date}T00:00:00+07:00`) - 8 * 60 * 60 * 1000);
}
