'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { DEMO_NOW, type Session, type Warning } from '@/lib/contracts';
import { monthDates, weekDates } from '@/lib/calendar';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const label = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { dateStyle: 'full', timeZone: 'UTC' });

export function WeekStrip({ date, onSelect }: { date: string; onSelect: (date: string) => void }) {
  return <nav className="week-strip" aria-label="Days of the week">
    {weekDates(date).map((day, index) => <button type="button" key={day}
      className={`week-day${day === date ? ' selected' : ''}${day === DEMO_NOW.slice(0, 10) ? ' is-today' : ''}`}
      aria-label={label(day)} aria-pressed={day === date} aria-current={day === DEMO_NOW.slice(0, 10) ? 'date' : undefined}
      onClick={() => onSelect(day)}><span>{days[index]}</span><strong>{Number(day.slice(8))}</strong></button>)}
  </nav>;
}

type MonthData = { month: string; sessions: Session[]; warnings: Warning[] };
export function MonthCalendar({ date, tutor, student, revision, onSelect }: {
  date: string; tutor: string; student: string; revision: number; onSelect: (date: string) => void;
}) {
  const month = date.slice(0, 7);
  const [data, setData] = useState<MonthData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError('');
    async function load() {
      try {
        const response = await fetch(`/api/schedule/month?date=${month}-01`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || 'Unable to load this month.');
        if (!controller.signal.aborted) setData(result);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load this month.');
      }
    }
    void load();
    return () => controller.abort();
  }, [month, revision, retry]);
  const current = data?.month === month ? data : null;
  const sessions = current?.sessions.filter(s => (!tutor || s.tutorId === tutor) && (!student || s.bookings.some(b => b.studentId === student))) ?? [];
  return <section className="month-calendar" aria-label="Monthly schedule" aria-busy={!current && !error}>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
    {!current && !error && <p className="calendar-loading" role="status">Loading month…</p>}
    <div className="month-weekdays" aria-hidden="true">{days.map(day => <span key={day}>{day}</span>)}</div>
    <div className="month-grid">{monthDates(date).map(day => {
      const inMonth = day.startsWith(month);
      const items = sessions.filter(s => s.date === day);
      const hasActiveSessions = items.some(s => s.bookings.some(b => b.status !== 'cancelled'));
      const cancelledOnly = items.length > 0 && !hasActiveSessions;
      const occupancyClass = current && inMonth ? hasActiveSessions ? ' has-sessions' : cancelledOnly ? ' cancelled-only' : ' empty-day' : '';
      const ids = new Set(items.map(s => s.id));
      const issues = current?.warnings.filter(w => w.sessionIds.some(id => ids.has(id))).length ?? 0;
      const summary = current && inMonth ? `${items.length} ${items.length === 1 ? 'session' : 'sessions'}${issues ? `, ${issues} scheduling ${issues === 1 ? 'issue' : 'issues'}` : ''}` : '';
      return <button type="button" key={day} onClick={() => onSelect(day)}
        className={`month-day${occupancyClass}${inMonth ? '' : ' outside-month'}${day === date ? ' selected' : ''}${day === DEMO_NOW.slice(0, 10) ? ' is-today' : ''}`}
        aria-label={`${label(day)}${summary ? `, ${summary}` : ''}${cancelledOnly ? ', all cancelled' : ''}`} aria-pressed={day === date}
        aria-current={day === DEMO_NOW.slice(0, 10) ? 'date' : undefined}>
        <span className="month-day-top"><strong>{Number(day.slice(8))}</strong>{issues > 0 && <AlertTriangle size={13} aria-hidden="true" />}</span>
        {current && inMonth && items.length > 0 && <><span className="month-count">{items.length}<span className="month-count-label"> {cancelledOnly ? 'cancelled' : items.length === 1 ? 'session' : 'sessions'}</span></span>
          <span className="month-previews">{items.slice(0, 2).map(s => <span key={s.id} className={s.bookings.every(b => b.status === 'cancelled') ? 'cancelled-preview' : ''}><b>{s.startTime}</b> {s.bookings.map(b => b.studentName).join(' & ')}</span>)}{items.length > 2 && <small>+{items.length - 2} more</small>}</span></>}
      </button>;
    })}</div>
    {current && sessions.length === 0 && <p className="calendar-loading">{tutor || student ? 'No sessions match these filters.' : 'No sessions this month.'}</p>}
  </section>;
}
