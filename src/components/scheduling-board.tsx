'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Plus, X, CalendarDays, RefreshCw, AlertTriangle, History, Users, Check, ChevronDown, SlidersHorizontal, Pencil, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { presentConflict } from '@/lib/conflict-presentation';
import { errorMessages, afterDraftChange } from '@/lib/form-feedback';
import { WeekStrip, MonthCalendar } from './schedule-calendar';
import { dayCache, monthCache, invalidateSchedule } from '@/lib/schedule-cache';
import { useScheduleResource } from '@/hooks/use-schedule-resource';
import { shiftMonth, weekDates } from '@/lib/calendar';
import { DEMO_NOW, INITIAL_DATE, TIMEZONE, type ApiError, type Booking, type BookingEdit, type ScheduleChange, type ScheduleData, type Session, type SessionInput, type Warning } from '@/lib/contracts';

const formatDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const weekday = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
const endTime = (s: Pick<Session, 'startTime' | 'durationMin'>) => { const [h, m] = s.startTime.split(':').map(Number); const t = h * 60 + m + s.durationMin; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const moveDay = (date: string, delta: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10); };
type EditField = 'startTime' | 'durationMin' | 'tutorId' | 'roomId' | `student-${string}` | `status-${string}`;
const statusLabel = (status: string) => status === 'no_show' ? 'No-show' : status === 'cancelled' ? 'Cancelled' : 'Booked';
function Status({ status }: { status: string }) { return <span className={`badge status-${status}`}>{status === 'booked' && <span className="status-dot" />}{statusLabel(status)}</span>; }
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
function ConflictItems({ warnings, sessions = [] }: { warnings: Warning[]; sessions?: Session[] }) {
  const groups = new Map<string, { code: string; item: ReturnType<typeof presentConflict> }>();
  for (const warning of warnings) {
    const item = warning.presentation ?? presentConflict(warning, sessions);
    const key = `${warning.code}:${item.title}`;
    const existing = groups.get(key);
    if (existing) existing.item = { ...existing.item, slots: [...existing.item.slots, ...item.slots].filter((slot,i,all) => all.findIndex(other => JSON.stringify(other) === JSON.stringify(slot)) === i) };
    else groups.set(key, { code: warning.code, item: { ...item, slots: [...item.slots] } });
  }
  return <div className="conflict-grid">{[...groups].map(([key,{code,item}]) => {
    const category = code === 'STUDENT_OVERLAP' ? 'Student' : code === 'TUTOR_OVERLAP' || code === 'TUTOR_DAILY_LIMIT' ? 'Tutor' : code === 'ROOM_OVERLAP' ? 'Room' : 'Schedule';
    return <section className="conflict-card" key={key}><span className="conflict-category">{category}</span><p className="conflict-title"><strong>{item.title}</strong></p>{item.action && <p className="conflict-action">{item.action}</p>}{item.slots.length > 0 && <details className="conflict-slot-details"><summary>View conflicting lessons<ChevronDown size={12} aria-hidden="true" /></summary><div className="conflict-sessions">{item.slots.map((slot,i) => <div className="conflict-session" key={i}><span>{shortDate(slot.date)}</span><strong>{slot.startTime}–{endTime(slot)}</strong><span>Room {slot.room}{slot.draft && <small className="conflict-draft"> · This change</small>}</span></div>)}</div></details>}</section>;
  })}</div>;
}
function Warnings({ warnings, prominent = false, sessions = [] }: { warnings: Warning[]; prominent?: boolean; sessions?: Session[] }) {
  if (!warnings.length) return null;
  return <section className="session-conflict-alert" role="alert" aria-label="Existing schedule conflicts"><div className="session-conflict-heading"><AlertTriangle size={18} aria-hidden="true" /><strong>Schedule conflict</strong><span className="conflict-saved-label">Saved schedule</span></div><ConflictItems warnings={warnings} sessions={sessions} /></section>;
}
function Snapshot({ session }: { session: Session | null }) { return session ? <div className="snapshot"><strong>{formatDay(session.date)} · {session.startTime}–{endTime(session)}</strong><span>{session.tutorName} · {session.roomId}</span>{session.note && <span>Note: {session.note}</span>}{session.bookings.map(b => <span key={b.id}>{b.studentName} · {statusLabel(b.status)}</span>)}</div> : <span className="muted">No previous session</span>; }
function Change({ change, date }: { change: ScheduleChange; date: string }) { const moved = change.before && change.before.date !== change.after.date; return <article className="change"><div className="change-heading"><strong>{moved ? change.before?.date === date ? `Moved to ${formatDay(change.after.date)}` : `Moved from ${formatDay(change.before!.date)}` : change.action === 'created' ? 'Session created' : change.action === 'cancelled' ? 'Booking cancelled' : 'Session updated'}</strong>{change.afterCutoff && <span className="badge warning-badge" title="Changed after the schedule cutoff; notification is not confirmed.">After cutoff</span>}<time>{new Date(change.occurredAt).toLocaleString('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</time></div>{change.reason && <p>{change.reason}</p>}<details><summary>View before and after</summary><div className="snapshot-grid"><div><span className="eyebrow">Before</span><Snapshot session={change.before} /></div><div><span className="eyebrow">After</span><Snapshot session={change.after} /></div></div></details></article>; }

export function SchedulingBoard() {
  const [date, setDate] = useState(INITIAL_DATE);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [calendarRevision, setCalendarRevision] = useState(0);
  const { data, loading, error: loadError, reload: refreshDay, refreshing } = useScheduleResource(dayCache, date);
  const [notice, setNotice] = useState('');
  const [tutor, setTutor] = useState('');
  const [student, setStudent] = useState('');
  const [editor, setEditor] = useState<{ session?: Session; field?: EditField } | null>(null);
  const [detailsSession, setDetailsSession] = useState<Session | null>(null);
  const [cancelling, setCancelling] = useState<{ session: Session; booking: Booking } | null>(null);
  const reload = useCallback(async (targetDate = date) => {
    if (targetDate === date) return refreshDay();
    try { await dayCache.load(targetDate, true); setDate(targetDate); return true; }
    catch { return false; }
  }, [date, refreshDay]);
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    // Preload the month's overview and visible day tabs after the current day resolves.
    void monthCache.load(date.slice(0, 7)).catch(() => {});
    const timer = window.setTimeout(async () => {
      for (const day of weekDates(date).filter(day => day !== date)) {
        if (cancelled) break;
        try { await dayCache.load(day); } catch { /* A foreground visit provides Retry. */ }
      }
    }, 150);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [date, data]);
  const saved = async () => { setEditor(null); setCancelling(null); setNotice('Changes saved.'); invalidateSchedule(); setCalendarRevision(value => value + 1); if (!(await reload())) setNotice('Saved successfully, but the schedule could not refresh. Reload before making another change.'); };
  const visible = data?.sessions.filter(s => (!tutor || s.tutorId === tutor) && (!student || s.bookings.some(b => b.studentId === student))) ?? [];
  const issues = data?.warnings.length ?? 0;
  const activeCount = data?.sessions.reduce((count, s) => count + s.bookings.filter(b => b.status !== 'cancelled').length, 0) ?? 0;
  const canWrite = !!data && !loading && !loadError;
  const cell = (s: Session, field: EditField, label: string, children: ReactNode) => <button type="button" className="cell-edit" disabled={!canWrite} aria-label={label} onClick={() => setEditor({ session: s, field })}>{children}</button>;
  const editButton = (s: Session) => <button className="button ghost edit-button" disabled={!canWrite} onClick={() => setEditor({ session: s })}><Pencil size={14} />Edit</button>;
  const students = (s: Session, mobile = false) => <div className="students">{s.mode === 'pair' && <span className="badge pair"><Users size={12} />Pair session</span>}{s.bookings.map(b => <div className="student-entry" key={b.id}><div className="student-name">{cell(s, `student-${b.id}`, `Edit student ${b.studentName}`, b.studentName)}{s.bookings.length > 1 && (mobile || s.bookings.some(booking => booking.status !== s.bookings[0].status)) && cell(s, `status-${b.id}`, `Edit status for ${b.studentName}`, <Status status={b.status} />)}</div></div>)}</div>;
  const actions = (s: Session) => <div className="row-actions">{editButton(s)}<SessionActions session={s} canWrite={canWrite} onDetails={() => setDetailsSession(s)} onCancel={b => setCancelling({ session: s, booking: b })} /></div>;
  const warnings = (s: Session) => { const count = data?.warnings.filter(w => w.sessionIds.includes(s.id)).length ?? 0; return count > 0 ? <button className="row-warning" aria-label={`View ${count} scheduling issues`} onClick={() => setDetailsSession(s)}><AlertTriangle size={15} /><span>{count}</span></button> : null; };

  return <><header className="site-header"><div className="header-inner"><a className="brand" href="/" aria-label="Bright Path home"><span className="brand-mark"><span /></span><span>bright path<span className="brand-caption">LEARNING CENTRE</span></span></a><details className="demo-info"><summary>Demo</summary><div><p>Sample data</p><p>Today: {new Date(DEMO_NOW).toLocaleString('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} · UTC+7</p></div></details></div></header>
    <main className="workspace">
      <section className="day-heading"><div><p className="eyebrow">SCHEDULE</p><h1>{view === 'month' ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : formatDay(date)}</h1><p className={`date-subtitle${view === 'month' ? ' reserved-space' : ''}`} aria-hidden={view === 'month'}>{weekday(date)}</p></div><button className="button primary add-button" disabled={!canWrite} onClick={() => setEditor({})}><Plus size={18} />Add session</button></section>
      <section className="board" aria-label="Daily schedule"><div className="board-toolbar"><div className="date-controls"><div className="nav-group"><button className="button icon" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => setDate(view === 'week' ? moveDay(date, -7) : shiftMonth(date, -1))}><ArrowLeft size={17} /></button><button className="button today" onClick={() => setDate(DEMO_NOW.slice(0, 10))}>Today</button><button className="button icon" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => setDate(view === 'week' ? moveDay(date, 7) : shiftMonth(date, 1))}><ArrowRight size={17} /></button></div><label className="date-input"><CalendarDays size={16} /><input aria-label="View date" type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} /></label></div><div className="schedule-totals"><div className="view-switch" role="group" aria-label="Calendar view">{(['week', 'month'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'week' ? 'Week' : 'Month'}</button>)}</div><span className={view === 'month' ? 'reserved-space' : ''} aria-hidden={view === 'month'}><strong>{data?.sessions.length ?? '—'}</strong> sessions</span><span className={view === 'month' ? 'reserved-space' : ''} aria-hidden={view === 'month'}><strong>{data ? activeCount : '—'}</strong> active bookings</span><button className="button icon refresh" aria-label="Refresh schedule" disabled={loading} onClick={() => { setNotice(''); invalidateSchedule(); setCalendarRevision(value => value + 1); void reload(); }}><RefreshCw size={16} className={loading || refreshing ? 'spin' : ''} /></button></div></div>
        <div className="filter-toolbar"><div className="filter-label"><SlidersHorizontal size={15} />Filter</div><label className="filter-select"><span className="sr-only">Filter by tutor</span><select value={tutor} onChange={e => setTutor(e.target.value)}><option value="">All tutors</option>{data?.tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="filter-select"><span className="sr-only">Filter by student</span><select value={student} onChange={e => setStudent(e.target.value)}><option value="">All students</option>{data?.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{(tutor || student) && <button className="text-button" onClick={() => { setTutor(''); setStudent(''); }}>Clear filters</button>}{(tutor || student) && <span className={`visible-count${view === 'month' ? ' reserved-space' : ''}`} aria-hidden={view === 'month'}>{visible.length} of {data?.sessions.length ?? 0} sessions</span>}</div>
        <div key={view} className={`schedule-content schedule-content--${view}`} tabIndex={0} role="region" aria-label={view === 'week' ? 'Day sessions' : 'Month calendar'}>
        {notice && <div role="status" className="notice"><Check size={16} />{notice}<button className="button icon" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {loadError && <div role="alert" className="error-banner"><AlertTriangle size={18} /><div><strong>Schedule unavailable</strong><p>{loadError}</p><button className="text-button" onClick={() => void reload()}>Try again</button></div></div>}
        {view === 'month' && <MonthCalendar date={date} tutor={tutor} student={student} revision={calendarRevision} onSelect={day => { setDate(day); setView('week'); }} />}
        {view === 'week' && <>
        <WeekStrip date={date} onSelect={setDate} />
        {!loadError && data && issues > 0 && <div className="issues-banner"><AlertTriangle size={17} /><span><strong>{issues} scheduling {issues === 1 ? 'issue' : 'issues'}</strong></span></div>}
        {loading && !data ? <div className="empty-state" role="status"><RefreshCw className="spin" size={24} /><h2>Loading schedule…</h2></div> : !loadError && !visible.length ? <div className="empty-state"><CalendarDays size={30} /><h2>{tutor || student ? 'No matching sessions' : 'No sessions scheduled'}</h2>{(tutor || student) && <p>Try another filter.</p>}{!(tutor || student) && <button className="button primary" disabled={!canWrite} onClick={() => setEditor({})}><Plus size={16} />Add the first session</button>}</div> : data && <><div className="table-wrap"><table><thead><tr><th>Time</th><th>Students</th><th>Tutor</th><th>Room</th><th>Status</th><th className="issues-column"><span className="sr-only">Warnings</span></th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(s => <tr key={s.id}><td className="time-cell">{cell(s, 'startTime', `Edit time for ${s.bookings.map(b => b.studentName).join(' and ')}`, <strong>{s.startTime}–{endTime(s)}</strong>)}{cell(s, 'durationMin', 'Edit duration', <small>{s.durationMin} min</small>)}</td><td>{students(s)}</td><td>{cell(s, 'tutorId', `Edit tutor ${s.tutorName}`, <><span className="tutor-name">{s.tutorName}</span><small>{data.tutors.find(t => t.id === s.tutorId)?.subject}</small></>)}</td><td>{cell(s, 'roomId', `Edit room ${s.roomId}`, <span className="room-label">{s.roomId}</span>)}</td><td>{cell(s, `status-${s.bookings[0].id}`, 'Edit booking statuses', s.bookings.length > 1 ? <span className="pair-summary">{s.bookings.filter(b => b.status === 'booked').length} booked{s.bookings.some(b => b.status === 'cancelled') && <small>{s.bookings.filter(b => b.status === 'cancelled').length} cancelled</small>}{s.bookings.some(b => b.status === 'no_show') && <small>{s.bookings.filter(b => b.status === 'no_show').length} no-show</small>}</span> : <Status status={s.bookings[0]?.status ?? 'cancelled'} />)}</td><td className="issues-column">{warnings(s)}</td><td>{actions(s)}</td></tr>)}</tbody></table></div><div className="mobile-sessions">{visible.map(s => <article className="mobile-session" key={s.id}><div className="mobile-session-top">{cell(s, 'startTime', 'Edit session time', <strong>{s.startTime}–{endTime(s)}<small>{s.durationMin} min</small></strong>)}{s.bookings.length === 1 && cell(s, `status-${s.bookings[0].id}`, 'Edit booking status', <Status status={s.bookings[0]?.status ?? 'cancelled'} />)}</div>{students(s, true)}<div className="mobile-resources">{cell(s, 'tutorId', `Edit tutor ${s.tutorName}`, <span><small>Tutor</small>{s.tutorName}</span>)}{cell(s, 'roomId', `Edit room ${s.roomId}`, <span><small>Room</small>{s.roomId}</span>)}</div><div className="mobile-session-bottom">{warnings(s)}{actions(s)}</div></article>)}</div></>}
        </>}
        </div>
        </section>
      {view === 'week' && <details className="history-panel"><summary><span><History size={18} /><strong>Changes for this day</strong><span className="count-badge">{data?.changes.length ?? 0}</span></span><ChevronDown size={18} /></summary><div className="history-body">{data?.changes.length ? data.changes.map(c => <Change key={c.id} change={c} date={date} />) : <p className="history-empty">No changes recorded.</p>}</div></details>}
      
    </main>{detailsSession && <Dialog title="Session details" busy={false} onClose={() => setDetailsSession(null)}><div className="modal-body session-details-body"><Snapshot session={detailsSession} />{data?.warnings.some(w => w.sessionIds.includes(detailsSession.id)) && <Warnings warnings={data.warnings.filter(w => w.sessionIds.includes(detailsSession.id))} sessions={data.sessions} prominent />}{detailsSession.bookings.map(b => <section className="booking-detail-section" key={b.id}><div className="booking-detail-heading"><strong>{b.studentName}</strong><Status status={b.status} /></div>{b.sourceNote && <p>{b.sourceNote}</p>}{b.cancelledAt && <p>Cancelled: {new Date(b.cancelledAt).toLocaleString('en-GB', { timeZone: TIMEZONE })}</p>}{b.reason && <p>Reason: {b.reason}</p>}</section>)}</div></Dialog>}{editor && data && <SessionDialog key={editor.session?.id ?? `new-${date}`} data={data} date={date} session={editor.session} initialField={editor.field} onClose={() => setEditor(null)} onSaved={saved} onReload={reload} />}{cancelling && <CancelDialog {...cancelling} onClose={() => setCancelling(null)} onSaved={saved} onReload={reload} />}</>;
}

function SessionActions({ session, canWrite, onDetails, onCancel }: { session: Session; canWrite: boolean; onDetails: () => void; onCancel: (booking: Booking) => void }) {
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = `session-actions-${session.id}-${useId()}`;
  const close = () => { menu.current?.hidePopover(); trigger.current?.focus(); };
  return <><button ref={trigger} type="button" className="button icon row-more" aria-label={`More actions for ${session.startTime}, ${session.bookings.map(b => b.studentName).join(' and ')}`} popoverTarget={id} onClick={e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const element = menu.current;
    if (element) { element.style.left = `${Math.max(8, Math.min(rect.right - 260, window.innerWidth - 268))}px`; element.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 200))}px`; }
  }}><MoreHorizontal size={18} /></button><div ref={menu} id={id} popover="auto" className="session-actions-menu"><button type="button" onClick={() => { close(); onDetails(); }}>View session details</button>{session.bookings.filter(b => b.status !== 'cancelled').map(b => <button key={b.id} type="button" className="cancel-action" disabled={!canWrite} onClick={() => { close(); onCancel(b); }}>Cancel booking · {b.studentName}</button>)}</div></>;
}

function Dialog({ title, children, onClose, busy, initialField }: { title: string; initialField?: EditField; children: ReactNode; onClose: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current; const trigger = document.activeElement as HTMLElement | null; dialog?.showModal(); if (initialField) dialog?.querySelector<HTMLElement>(`[data-edit-field="${initialField}"]`)?.focus(); return () => { dialog?.close(); trigger?.focus(); }; }, [initialField]);
  return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} aria-labelledby={titleId}><div className="modal-header"><div><h2 id={titleId}>{title}</h2></div><button className="button icon" disabled={busy} aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>{children}</dialog>;
}
function DiscardDialog({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return <Dialog title="Discard unsaved changes?" busy={false} onClose={onKeep}><div className="discard-dialog-body modal-body"><p>Your changes have not been saved.</p></div><div className="modal-footer"><button type="button" className="button secondary" autoFocus onClick={onKeep}>Keep editing</button><button type="button" className="button danger" onClick={onDiscard}>Discard changes</button></div></Dialog>;
}
function ErrorSummary({ error }: { error: ApiError | null }) { const ref = useRef<HTMLDivElement>(null); useEffect(() => { if (error) ref.current?.focus(); }, [error]); return error ? <div ref={ref} tabIndex={-1} className={`form-error${error.conflicts?.length ? ' conflict-error' : ''}`} role="alert"><strong>{error.code === 'UNKNOWN_OUTCOME' ? 'Save status unknown' : 'Cannot save this change'}</strong>{error.conflicts?.length ? <ConflictItems warnings={error.conflicts} /> : errorMessages(error).map(message => <p key={message}>{message}</p>)}</div> : null; }
function useMutation(onSaved: () => Promise<void>) {
  const [pending, setPending] = useState(false); const [error, setError] = useState<ApiError | null>(null); const [uncertain, setUncertain] = useState(false);
  async function submit(url: string, method: string, body: unknown) {
    if (pending || uncertain) return;
    setPending(true); setError(null);
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let result: { error?: ApiError }; try { result = await response.json(); } catch { throw new Error('The server response could not be confirmed.'); }
      if (!response.ok) { if (response.status >= 500) throw new Error('The server could not confirm the result.'); setError(result.error ?? { code: 'SAVE_FAILED', message: 'The request was rejected. Check your draft and try again.' }); return; }
      await onSaved();
    } catch { setUncertain(true); setError({ code: 'UNKNOWN_OUTCOME', message: 'The connection ended before confirmation. This change may already be saved. Reload the latest schedule and review it before making another change.' }); }
    finally { setPending(false); }
  }
  return { pending, error, uncertain, submit, clearValidation: () => setError(afterDraftChange) };
}
function SessionDialog({ data, date, session, initialField, onClose, onSaved, onReload }: { data: ScheduleData; date: string; session?: Session; initialField?: EditField; onClose: () => void; onSaved: () => Promise<void>; onReload: (targetDate?: string) => Promise<boolean> }) {
  const initial: SessionInput = { date: session?.date ?? date, startTime: session?.startTime ?? '09:00', durationMin: (session?.durationMin ?? 60) as 60 | 90, tutorId: session?.tutorId ?? '', roomId: session?.roomId ?? '', mode: session?.mode ?? 'one_to_one', studentIds: session?.bookings.map(b => b.studentId) ?? ['', ''], note: session?.note ?? '', reason: '' };
  const originalBookings = session?.bookings.map(({id, studentId, status}) => ({id, studentId, status})) ?? [];
  const [bookings, setBookings] = useState<BookingEdit[]>(originalBookings);
  const [draft, setDraft] = useState(initial);
  const [discard, setDiscard] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const submittedDate = useRef(initial.date);
  const mutation = useMutation(onSaved);
  const update = <K extends keyof SessionInput>(key: K, value: SessionInput[K]) => setDraft(d => ({...d, [key]:value}));
  const changed = JSON.stringify({...draft, reason:''}) !== JSON.stringify(initial) || JSON.stringify(bookings) !== JSON.stringify(originalBookings);
  const dirty = changed || !!draft.reason;
  const capacityError = !!session && draft.mode === 'one_to_one' && bookings.filter(b => b.status !== 'cancelled').length > 1;
  const fieldError = (field: string) => mutation.error?.fieldErrors?.[field]?.map((message, i) => <span className="field-error" key={i}>{message}</span>);
  const reloadLatest = async () => { setReloading(true); if (await onReload(mutation.uncertain ? submittedDate.current : session?.date ?? date)) onClose(); setReloading(false); };
  const close = () => { if (mutation.pending || reloading) return; if (mutation.uncertain) { void reloadLatest(); return; } if (dirty) setDiscard(true); else onClose(); };
  const selectMode = (mode: SessionInput['mode']) => {
    update('mode', mode);
    if (session) setBookings(items => mode === 'pair' && items.length < 2 ? [...items, {studentId:'',status:'booked'}] : mode === 'one_to_one' ? items.filter(b => b.id) : items);
  };
  const save = (reason = '') => {
    if (mutation.pending || mutation.uncertain || reloading || capacityError || (session && (!changed || !reason.trim()))) return;
    const body = session ? {date:draft.date,startTime:draft.startTime,durationMin:draft.durationMin,tutorId:draft.tutorId,roomId:draft.roomId,mode:draft.mode,note:draft.note,reason:reason.trim(),expectedVersion:session.version,bookings} : {...draft,reason:draft.reason?.trim(),studentIds:draft.studentIds.slice(0,draft.mode === 'pair' ? 2 : 1)};
    submittedDate.current = draft.date;
    setReasonOpen(false);
    void mutation.submit(session ? `/api/sessions/${session.id}` : '/api/sessions', session ? 'PATCH' : 'POST', body);
  };
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (mutation.pending || mutation.uncertain || reloading || capacityError || (session && !changed)) return;
    if (session) setReasonOpen(true);
    else save();
  };
  const sessionWarnings = session ? data.warnings.filter(w => w.sessionIds.includes(session.id)) : [];
  return <><Dialog title={session ? 'Edit session' : 'Add a session'} initialField={initialField} onClose={close} busy={mutation.pending || reloading}><form className="session-form" onSubmit={submit} onChange={mutation.clearValidation}><div className="modal-body session-editor">
    <ErrorSummary error={mutation.error} />
    {(mutation.uncertain || mutation.error?.code.includes('STALE')) && <button type="button" className="button secondary" disabled={reloading} onClick={() => void reloadLatest()}>{reloading ? 'Reloading…' : 'Load latest schedule and close draft'}</button>}
    <fieldset className="session-inputs" disabled={mutation.pending || mutation.uncertain || reloading}>
    <section className="editor-section" aria-label="Session schedule">
      <div className="form-grid schedule-fields">
        <label>Date<input type="date" required value={draft.date} onChange={e => update('date',e.target.value)} />{fieldError('date')}</label>
        <label>Start time<input data-edit-field="startTime" type="time" required value={draft.startTime} onChange={e => update('startTime',e.target.value)} />{fieldError('startTime')}</label>
        <label>Duration<select data-edit-field="durationMin" value={draft.durationMin} onChange={e => update('durationMin',Number(e.target.value) as 60 | 90)}><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select>{fieldError('durationMin')}</label>
      </div>
      <p className="end-time">Ends at <strong>{draft.startTime ? endTime({startTime:draft.startTime,durationMin:draft.durationMin} as Session) : '—'}</strong></p>
      <div className="form-grid">
        <label>Tutor<select data-edit-field="tutorId" required value={draft.tutorId} onChange={e => update('tutorId',e.target.value)}><option value="">Select a tutor</option>{data.tutors.map(t => <option key={t.id} value={t.id}>{t.name} · {t.subject}</option>)}</select>{fieldError('tutorId')}</label>
        <label>Room<select data-edit-field="roomId" required value={draft.roomId} onChange={e => update('roomId',e.target.value)}><option value="">Select a room</option>{data.rooms.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}</select>{fieldError('roomId')}</label>
      </div>
    </section>
    <section className="editor-section roster-editor" aria-label="Students and statuses">
      <fieldset className="mode-field"><legend>Session type</legend><div className="mode-options">{(['one_to_one','pair'] as const).map(mode => <label key={mode} className={draft.mode === mode ? 'selected' : ''}><input type="radio" name="mode" checked={draft.mode === mode} onChange={() => selectMode(mode)} />{mode === 'pair' ? 'Pair' : 'One-to-one'}</label>)}</div></fieldset>
      {session ? bookings.map((booking,index) => {
        const original = session.bookings.find(b => b.id === booking.id);
        const statusChanged = original && original.status !== booking.status;
        return <div className="booking-edit-row" key={booking.id ?? 'new-booking'}><div className="form-grid booking-fields">
          <label>Student {bookings.length > 1 ? index + 1 : ''}<select required data-edit-field={`student-${booking.id}`} value={booking.studentId} onChange={e => setBookings(items => items.map((b,i) => i === index ? {...b,studentId:e.target.value} : b))}><option value="">Select a student</option>{data.students.map(student => <option key={student.id} value={student.id} disabled={bookings.some((b,i) => i !== index && b.studentId === student.id) || session.bookings.some(b => b.id !== booking.id && b.studentId === student.id)}>{student.name}</option>)}</select></label>
          <label>Status<select className={`status-select status-${booking.status}`} data-edit-field={`status-${booking.id}`} value={booking.status} onChange={e => setBookings(items => items.map((b,i) => i === index ? {...b,status:e.target.value as Booking['status']} : b))}><option value="booked">Booked</option><option value="no_show">No-show</option><option value="cancelled">Cancelled</option></select></label>
        </div>
        {statusChanged && <p className="status-impact">{booking.status === 'cancelled' ? 'This booking will release its place.' : original.status === 'cancelled' ? 'Restoring this booking will check availability again.' : booking.status === 'no_show' ? 'No-show still reserves the time slot.' : 'This booking will be marked as booked.'}</p>}
        {original?.status === 'cancelled' && <p className="cancellation-detail">Cancelled{original.cancelledAt ? ` · ${new Date(original.cancelledAt).toLocaleString('en-GB',{timeZone:TIMEZONE,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}` : ''}{original.reason ? ` · ${original.reason}` : ''}</p>}
        {original && <>{original.sourceNote && <p className="booking-source-note">{original.sourceNote}</p>}{original.status !== 'cancelled' && original.reason && <p>Previous reason: {original.reason}</p>}</>}
        </div>;
      }) : <div className="form-grid">{Array.from({length:draft.mode === 'pair' ? 2 : 1},(_,i) => <label key={i}>Student {draft.mode === 'pair' ? i + 1 : ''}<select required value={draft.studentIds[i] ?? ''} onChange={e => {const ids=[...draft.studentIds];ids[i]=e.target.value;update('studentIds',ids);}}><option value="">Select a student</option>{data.students.map(student => <option key={student.id} value={student.id} disabled={draft.mode === 'pair' && draft.studentIds[1-i] === student.id}>{student.name}</option>)}</select>{fieldError('studentIds')}</label>)}</div>}
      {capacityError && <p className="field-error" role="alert">Choose which booking to cancel before switching to one-to-one.</p>}{fieldError('bookings')}{fieldError('mode')}
    </section>
    {sessionWarnings.length > 0 && <Warnings warnings={sessionWarnings} sessions={data.sessions} prominent />}
    <div className="form-grid editor-notes editor-notes-single"><label>Reception note <span className="optional-label">Optional</span><textarea rows={2} maxLength={1000} value={draft.note} onChange={e => update('note',e.target.value)} />{fieldError('note')}</label></div>
    </fieldset>

  </div><div className="modal-footer"><span className="draft-status" aria-live="polite">{session && changed ? 'Unsaved changes' : ''}</span><button type="button" className="button secondary" disabled={mutation.pending} onClick={close}>Cancel</button><button className="button primary" disabled={mutation.pending || mutation.uncertain || reloading || capacityError || (!!session && !changed)}>{mutation.pending ? 'Saving…' : session ? 'Save changes' : 'Create session'}<ArrowUpRight size={16} /></button></div></form></Dialog>{discard && <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />}{reasonOpen && <Dialog title="Reason for change" busy={false} onClose={() => setReasonOpen(false)}><form className="change-reason-form" onSubmit={e => { e.preventDefault(); if (!draft.reason?.trim()) { const input = e.currentTarget.querySelector('textarea'); input?.setCustomValidity('Enter a reason for this change.'); input?.reportValidity(); return; } save(draft.reason); }}><div className="modal-body"><p className="reason-intro">Add a short reason so the next person understands this change.</p><label className="field">Reason<textarea autoFocus required rows={3} maxLength={500} value={draft.reason} onChange={e => { e.target.setCustomValidity(''); update('reason', e.target.value); }} placeholder="For example, the family requested a different time." /></label></div><div className="modal-footer"><button type="button" className="button secondary" onClick={() => setReasonOpen(false)}>Back to editing</button><button className="button primary">Confirm changes<Check size={16} /></button></div></form></Dialog>}</>;
}
function CancelDialog({ session, booking, onClose, onSaved, onReload }: { session: Session; booking: Booking; onClose: () => void; onSaved: () => Promise<void>; onReload: (targetDate?: string) => Promise<boolean> }) {
  const [reason, setReason] = useState(''); const [discard, setDiscard] = useState(false); const [reloading, setReloading] = useState(false); const mutation = useMutation(onSaved); const remaining = session.bookings.filter(b => b.id !== booking.id && b.status !== 'cancelled');
  const close = () => { if (reloading) return; if (mutation.uncertain) { setReloading(true); void onReload().then(ok => { if (ok) onClose(); }).finally(() => setReloading(false)); return; } if (!mutation.pending) { if (reason) setDiscard(true); else onClose(); } };
  return <><Dialog title="Cancel booking?" onClose={close} busy={mutation.pending || reloading}><form className="cancel-booking-form" onChange={mutation.clearValidation} onSubmit={e => { e.preventDefault(); if (!reason.trim()) { const input = e.currentTarget.querySelector('textarea'); input?.setCustomValidity('Enter a cancellation reason, not only spaces.'); input?.reportValidity(); return; } void mutation.submit(`/api/bookings/${booking.id}/cancel`, 'POST', { expectedVersion: session.version, reason: reason.trim() }); }}><div className="modal-body"><ErrorSummary error={mutation.error} />{(mutation.uncertain || mutation.error?.code.includes('STALE')) && <button className="button secondary" type="button" disabled={reloading} onClick={async () => { setReloading(true); if (await onReload()) onClose(); setReloading(false); }}>{reloading ? 'Reloading…' : 'Load latest schedule and close draft'}</button>}<div className="cancel-overview"><strong>{booking.studentName}</strong><span>{formatDay(session.date)} · {session.startTime}–{endTime(session)}</span><span>{session.tutorName} · {session.roomId}</span></div><div className="info-box"><Users size={17} /><p>{remaining.length ? `${remaining.map(b => b.studentName).join(', ')} remains booked. The tutor and room stay reserved.` : 'This is the last active booking. Cancelling releases the tutor and room.'}</p></div><label className="field">Reason for cancellation<textarea disabled={mutation.pending || mutation.uncertain || reloading} autoFocus required rows={3} maxLength={500} value={reason} onChange={e => { e.target.setCustomValidity(!e.target.value.trim() ? 'Enter a cancellation reason, not only spaces.' : ''); setReason(e.target.value); }} placeholder="Explain why this booking is being cancelled." />{mutation.error?.fieldErrors?.reason?.map((message, i) => <span className="field-error" key={i}>{message}</span>)}</label></div><div className="modal-footer"><button type="button" className="button secondary" disabled={mutation.pending} onClick={close}>Keep booking</button><button className="button danger" disabled={mutation.pending || mutation.uncertain || reloading}>{mutation.pending ? 'Cancelling…' : 'Cancel booking'}</button></div></form></Dialog>{discard && <DiscardDialog onKeep={() => setDiscard(false)} onDiscard={onClose} />}</>;
}
