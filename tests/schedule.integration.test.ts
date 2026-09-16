import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db, closeDb } from '../src/lib/server/db';
import { cancelBooking, createSession, editSession, getSchedule, readSessions } from '../src/lib/server/service';
import * as domain from '../src/lib/domain';
import type { Session, SessionInput } from '../src/lib/contracts';

const testUrl = process.env.TEST_DATABASE_URL;
const testSchema = process.env.TEST_DB_SCHEMA;
const previousUrl = process.env.DATABASE_URL;
const previousSchema = process.env.DB_SCHEMA;
// Explicitly opt in. Never fall back to the demo DATABASE_URL or clean up retained test rows.
const suite = testUrl ? describe : describe.skip;
const future = new Date();
future.setUTCFullYear(future.getUTCFullYear() + 1);
while (future.getUTCDay() === 1) future.setUTCDate(future.getUTCDate() + 1);
const date = future.toISOString().slice(0, 10);
function nextOpenDate(value: string): string {
  const next = new Date(`${value}T00:00:00Z`);
  do { next.setUTCDate(next.getUTCDate() + 1); } while (next.getUTCDay() === 1);
  return next.toISOString().slice(0, 10);
}

suite('PostgreSQL schedule transactions (isolated retained fixtures)', () => {
  beforeAll(async () => {
    if (testSchema !== 'bright_path_test') throw new Error('Integration tests require TEST_DB_SCHEMA=bright_path_test.');
    await closeDb();
    process.env.DATABASE_URL = testUrl!;
    process.env.DB_SCHEMA = testSchema;
    await db()`select 1 from ${db()('bright_path_test.sessions')} limit 1`;
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await closeDb();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    if (previousSchema === undefined) delete process.env.DB_SCHEMA;
    else process.env.DB_SCHEMA = previousSchema;
  });

  async function fixtures() {
    const prefix = `integration-${randomUUID()}`;
    const tutorId = `${prefix}-tutor`;
    const roomId = `${prefix}-room`;
    const otherRoomId = `${prefix}-other-room`;
    const students = Array.from({ length: 9 }, (_, i) => `${prefix}-student-${i}`);
    await db().begin(async (tx) => {
      await tx`insert into bright_path_test.tutors (id,name,subject,phone) values (${tutorId},${prefix},'Integration','test')`;
      await tx`insert into bright_path_test.rooms (id) values (${roomId}),(${otherRoomId})`;
      for (const id of students) await tx`insert into bright_path_test.students (id,name) values (${id},${id})`;
    });
    const input: SessionInput = { date, startTime: '09:00', durationMin: 60, tutorId, roomId, mode: 'one_to_one', studentIds: [students[0]] };
    return { tutorId, roomId, otherRoomId, students, input };
  }
  async function find(id: string) {
    const result = (await readSessions(db())).find((session) => session.id === id);
    if (!result) throw new Error(`Missing test session ${id}`);
    return result;
  }
  function edit(session: Session, patch: Partial<Parameters<typeof editSession>[1]> = {}) {
    return { date: session.date, startTime: session.startTime, durationMin: session.durationMin as 60 | 90, tutorId: session.tutorId, roomId: session.roomId, expectedVersion: session.version, reason: 'Integration test change', ...patch };
  }
  async function rawSession(input: SessionInput, status: 'booked' | 'no_show' = 'booked') {
    const id = randomUUID();
    const start = `${input.date}T${input.startTime}:00+07:00`;
    await db().begin(async (tx) => {
      await tx`insert into bright_path_test.sessions (id,starts_at,ends_at,tutor_id,room_id,mode,version)
        values (${id},${start}::timestamptz,${start}::timestamptz + ${input.durationMin} * interval '1 minute',${input.tutorId},${input.roomId},${input.mode},1)`;
      for (const studentId of input.studentIds) await tx`insert into bright_path_test.bookings (id,session_id,student_id,status) values (${randomUUID()},${id},${studentId},${status})`;
    });
    return find(id);
  }

  it('serializes conflicting concurrent creates so exactly one commits', async () => {
    const f = await fixtures();
    const outcomes = await Promise.allSettled([
      createSession(f.input),
      createSession({ ...f.input, studentIds: [f.students[1]] }),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409, code: 'SCHEDULE_CONFLICT' });
    const rows = (await readSessions(db(), date)).filter((session) => session.tutorId === f.tutorId);
    expect(rows).toHaveLength(1);
    expect(rows[0].bookings).toHaveLength(1);
    const history = (await getSchedule(date)).changes.filter((change) => change.sessionId === rows[0].id);
    expect(history).toHaveLength(1);
  });

  it('rejects stale edit and cancellation versions without extra history', async () => {
    const f = await fixtures();
    const created = await createSession(f.input);
    const initial = await find(created.id);
    await editSession(initial.id, edit(initial, { startTime: '10:00' }));
    await expect(editSession(initial.id, edit(initial, { startTime: '11:00' }))).rejects.toMatchObject({ code: 'STALE_VERSION' });
    await expect(cancelBooking(initial.bookings[0].id, { expectedVersion: 1, reason: 'Stale attempt' })).rejects.toMatchObject({ code: 'STALE_VERSION' });
    expect((await find(created.id)).version).toBe(2);
    expect((await getSchedule(date)).changes.filter((change) => change.sessionId === created.id)).toHaveLength(2);
  });

  it('retains pair occupancy after first cancellation and releases it after last', async () => {
    const f = await fixtures();
    const created = await createSession({ ...f.input, mode: 'pair', studentIds: f.students.slice(0, 2) });
    const pair = await find(created.id);
    await cancelBooking(pair.bookings[0].id, { expectedVersion: 1, reason: 'First family cancelled' });
    await expect(createSession({ ...f.input, studentIds: [f.students[2]] })).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' });
    await cancelBooking(pair.bookings[1].id, { expectedVersion: 2, reason: 'Second family cancelled' });
    await expect(createSession({ ...f.input, studentIds: [f.students[2]] })).resolves.toMatchObject({ version: 1 });
    await expect(cancelBooking(pair.bookings[0].id, { expectedVersion: 3, reason: 'Repeated cancellation' })).rejects.toMatchObject({ code: 'ALREADY_CANCELLED' });
    await expect(editSession(pair.id, edit(pair, { expectedVersion: 3 }))).rejects.toMatchObject({ code: 'SESSION_NOT_EDITABLE' });
    const changes = (await getSchedule(date)).changes.filter((change) => change.sessionId === pair.id);
    expect(changes).toHaveLength(3);
    expect(changes.filter((change) => change.action === 'cancelled')).toHaveLength(2);
  });

  it('preserves no-show occupancy and refuses rescheduling it', async () => {
    const f = await fixtures();
    const historical = await rawSession(f.input, 'no_show');
    await expect(createSession({ ...f.input, studentIds: [f.students[1]] })).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' });
    await expect(editSession(historical.id, edit(historical, { startTime: '11:00' }))).rejects.toMatchObject({ code: 'SESSION_NOT_EDITABLE' });
  });

  it('rejects room-only edits while historical load is seven, but permits cancellation', async () => {
    const f = await fixtures();
    const historical: Session[] = [];
    for (let index = 0; index < 7; index++) historical.push(await rawSession({ ...f.input, startTime: `${String(9 + index).padStart(2, '0')}:00`, studentIds: [f.students[index]] }));
    await expect(editSession(historical[0].id, edit(historical[0], { roomId: f.otherRoomId }))).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT', conflicts: expect.arrayContaining([expect.objectContaining({ code: 'TUTOR_DAILY_LIMIT' })]) });
    await cancelBooking(historical[6].bookings[0].id, { expectedVersion: 1, reason: 'Resolve excessive load' });
    await expect(editSession(historical[0].id, edit(historical[0], { roomId: f.otherRoomId }))).resolves.toMatchObject({ version: 2 });
  });

  it('edits student and status atomically, and rejects conflicting restoration', async () => {
    const f = await fixtures();
    const created = await createSession(f.input);
    let session = await find(created.id);
    await editSession(session.id, edit(session, { bookings: [{ id: session.bookings[0].id, studentId: f.students[1], status: 'cancelled' }] }));
    session = await find(created.id);
    expect(session.bookings[0]).toMatchObject({ studentId: f.students[1], status: 'cancelled' });
    expect(session.bookings[0].cancelledAt).not.toBeNull();
    await createSession({ ...f.input, studentIds: [f.students[2]] });
    await expect(editSession(session.id, edit(session, { bookings: [{ id: session.bookings[0].id, studentId: f.students[1], status: 'booked' }] }))).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' });
    expect((await find(session.id)).version).toBe(2);
    const changes = (await getSchedule(date)).changes.filter(c => c.sessionId === session.id);
    expect(changes).toHaveLength(2);
    expect(changes[0].before?.bookings[0].studentId).toBe(f.students[0]);
    expect(changes[0].after.bookings[0].studentId).toBe(f.students[1]);
  });

  it('allows cancellation through the editor on an invalid imported day', async () => {
    const f = await fixtures();
    const session = await rawSession({ ...f.input, date: '2026-03-09' });
    await expect(editSession(session.id, edit(session, { bookings: session.bookings.map(b => ({ id: b.id, studentId: b.studentId, status: 'cancelled' })) }))).resolves.toMatchObject({ version: 2 });
  });

  it('converts one-to-one to pair, retains cancelled history, and persists notes', async () => {
    const f = await fixtures();
    const created = await createSession(f.input);
    let session = await find(created.id);
    await editSession(session.id, edit(session, {mode:'pair',note:'Bring workbook',bookings:[{id:session.bookings[0].id,studentId:f.students[0],status:'booked'},{studentId:f.students[1],status:'booked'}]}));
    session=await find(created.id);
    expect(session.mode).toBe('pair');
    expect(session.note).toBe('Bring workbook');
    expect(session.bookings).toHaveLength(2);
    await expect(editSession(session.id,edit(session,{mode:'one_to_one',bookings:session.bookings.map(b=>({id:b.id,studentId:b.studentId,status:b.status}))}))).rejects.toMatchObject({code:'SESSION_CAPACITY'});
    await editSession(session.id,edit(session,{mode:'one_to_one',bookings:session.bookings.map((b,i)=>({id:b.id,studentId:b.studentId,status:i===1?'cancelled':'booked'}))}));
    session=await find(created.id);
    expect(session.bookings).toHaveLength(2);
    expect(session.bookings.filter(b=>b.status==='booked')).toHaveLength(1);
    expect(session.note).toBe('Bring workbook');
  });

  it('shows move snapshots on both the old and new day', async () => {
    const f = await fixtures();
    const created = await createSession(f.input);
    const before = await find(created.id);
    const target = nextOpenDate(date);
    await editSession(before.id, edit(before, { date: target }));
    const oldDay = await getSchedule(date);
    const newDay = await getSchedule(target);
    expect(oldDay.sessions.some((session) => session.id === before.id)).toBe(false);
    for (const schedule of [oldDay, newDay]) {
      expect(schedule.changes).toEqual(expect.arrayContaining([expect.objectContaining({ sessionId: before.id, action: 'rescheduled', before: expect.objectContaining({ date }), after: expect.objectContaining({ date: target }) })]));
    }
  });

  it('rolls back real session and booking inserts if audit computation fails', async () => {
    const f = await fixtures();
    // audit() computes cutoff only after session and booking INSERT statements have run.
    // Throw at that boundary to exercise PostgreSQL rollback, without DDL or a privileged trigger.
    const cutoff = vi.spyOn(domain, 'isAfterCutoff').mockImplementationOnce(() => { throw new Error('Forced audit failure'); });
    try {
      await expect(createSession(f.input)).rejects.toThrow('Forced audit failure');
    } finally {
      cutoff.mockRestore();
    }
    const sessions = await db()`select id from bright_path_test.sessions where tutor_id=${f.tutorId}`;
    const bookings = await db()`select id from bright_path_test.bookings where student_id=${f.students[0]}`;
    const audits = await db()`select id from bright_path_test.schedule_changes where after_snapshot->>'tutorId'=${f.tutorId}`;
    expect(sessions).toHaveLength(0);
    expect(bookings).toHaveLength(0);
    expect(audits).toHaveLength(0);
    await expect(createSession(f.input)).resolves.toMatchObject({ version: 1 });
  });
});
