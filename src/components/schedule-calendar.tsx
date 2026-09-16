'use client';

import { useEffect, useRef, useState } from 'react';
import { useScheduleResource } from '@/hooks/use-schedule-resource';
import { dayCache, monthCache } from '@/lib/schedule-cache';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { DEMO_NOW } from '@/lib/contracts';
import { monthDates, weekDates } from '@/lib/calendar';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const label = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { dateStyle: 'full', timeZone: 'UTC' });

export function WeekStrip({ date, onSelect }: { date: string; onSelect: (date: string) => void }) {
  return <nav className="week-strip" aria-label="Days of the week">
    {weekDates(date).map((day, index) => <button type="button" key={day}
      className={`week-day${day === date ? ' selected' : ''}${day === DEMO_NOW.slice(0, 10) ? ' is-today' : ''}`}
      aria-label={label(day)} aria-pressed={day === date} aria-current={day === DEMO_NOW.slice(0, 10) ? 'date' : undefined}
      onPointerEnter={() => { void dayCache.load(day).catch(() => {}); }} onFocus={() => { void dayCache.load(day).catch(() => {}); }} onClick={() => onSelect(day)}><span>{days[index]}</span><strong>{Number(day.slice(8))}</strong></button>)}
  </nav>;
}

export function MonthCalendar({ date, tutor, student, revision, onSelect }: {
  date: string; tutor: string; student: string; revision: number; onSelect: (date: string) => void;
}) {
  const [selection, setSelection] = useState<{day: string; scope: string; left: number; top: number} | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const popover = useRef<HTMLDivElement | null>(null);
  const selectedDay = selection?.scope === date ? selection.day : null;
  useEffect(() => {
    if (!selectedDay) return;
    popover.current?.querySelector<HTMLButtonElement>('.month-open-day')?.focus({preventScroll:true});
    const dismiss = () => setSelection(null);
    const outside = (event: PointerEvent) => { if (!popover.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) dismiss(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { dismiss(); trigger.current?.focus({preventScroll:true}); } };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', key);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', key); window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true); };
  }, [selectedDay]);
  const month = date.slice(0, 7);
  const { data: current, error, reload } = useScheduleResource(monthCache, month);
  useEffect(() => { void monthCache.load(month).catch(() => {}); }, [month, revision]);
  const sessions = current?.sessions.filter(s => (!tutor || s.tutorId === tutor) && (!student || s.bookings.some(b => b.studentId === student))) ?? [];
  return <section className="month-calendar" aria-label="Monthly schedule" aria-busy={!current && !error}>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => void reload()}>Retry</button></div>}
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
      return <button type="button" key={day} onPointerEnter={() => { void dayCache.load(day).catch(() => {}); }} onFocus={() => { void dayCache.load(day).catch(() => {}); }} onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); trigger.current = event.currentTarget; setSelection({day, scope: date, left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.min(260, window.innerWidth - 24) - 12)), top: rect.bottom + 174 < window.innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - 174)}); void dayCache.load(day).catch(() => {}); }}
        className={`month-day${occupancyClass}${inMonth ? '' : ' outside-month'}${day === (selectedDay ?? date) ? ' selected' : ''}${day === DEMO_NOW.slice(0, 10) ? ' is-today' : ''}`}
        aria-label={`${label(day)}${summary ? `, ${summary}` : ''}${cancelledOnly ? ', all cancelled' : ''}`} aria-pressed={day === (selectedDay ?? date)}
        aria-current={day === DEMO_NOW.slice(0, 10) ? 'date' : undefined} aria-haspopup="dialog" aria-expanded={selectedDay === day}>
        <span className="month-day-top"><strong>{Number(day.slice(8))}</strong>{issues > 0 && <AlertTriangle size={13} aria-hidden="true" />}</span>
        {current && inMonth && items.length > 0 && <><span className="month-count">{items.length}<span className="month-count-label"> {cancelledOnly ? 'cancelled' : items.length === 1 ? 'session' : 'sessions'}</span></span>
          <span className="month-previews">{items.slice(0, 2).map(s => <span key={s.id} className={s.bookings.every(b => b.status === 'cancelled') ? 'cancelled-preview' : ''}><b>{s.startTime}</b> {s.bookings.map(b => b.studentName).join(' & ')}</span>)}{items.length > 2 && <small>+{items.length - 2} more</small>}</span></>}
      </button>;
    })}</div>
    {selectedDay && selection && createPortal(<div ref={popover} className="month-day-popover" role="dialog" aria-label={`Open ${label(selectedDay)}`} style={{left:selection.left,top:selection.top}}>
      <div className="month-popover-heading"><strong>{new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})}</strong><button type="button" className="button icon" aria-label="Close day preview" onClick={() => {setSelection(null);trigger.current?.focus({preventScroll:true});}}><X size={16} /></button></div>
      <p>{selectedDay.startsWith(month) && current ? `${sessions.filter(s => s.date === selectedDay).length} sessions${tutor || student ? ' matching filters' : ''}` : 'Open this day’s schedule'}</p>
      <button type="button" className="button primary month-open-day" onClick={() => onSelect(selectedDay)}>View day <ArrowRight size={15} /></button>
    </div>, document.body)}
    {current && sessions.length === 0 && <p className="calendar-loading">{tutor || student ? 'No sessions match these filters.' : 'No sessions this month.'}</p>}
  </section>;
}
