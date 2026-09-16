import { blockingWarnings, exceptionAuditReason } from '../closed-day';
import { replaceBooking } from '../booking-replacement';
import { editPolicyError } from '../edit-policy';
import { monthBounds } from '../calendar';
import { randomUUID } from 'node:crypto';
import type { Sql, TransactionSql } from 'postgres';
import { db, schema } from './db';
import { detectWarnings, validateSession, isAfterCutoff } from '../domain';
import { DEMO_NOW, TIMEZONE, type Session, type ScheduleChange, type ScheduleData, type SessionInput, type EditInput, type CancelInput, type Warning, type Student, type Tutor } from '../contracts';

type Query = Sql | TransactionSql;
export class ScheduleError extends Error {
  constructor(public status: number, public code: string, message: string, public conflicts?: Warning[]) { super(message); }
}
function table(q: Query, name: string) { return q(`${schema()}.${name}`); }
export async function readSessions(q: Query, date?: string, endDate?: string): Promise<Session[]> {
  const rows = await q`select s.id, to_char(s.starts_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as date,
    to_char(s.starts_at at time zone 'Asia/Ho_Chi_Minh','HH24:MI') as start_time,
    (extract(epoch from (s.ends_at-s.starts_at))/60)::int as duration_min,
    s.tutor_id, t.name as tutor_name, s.room_id, s.mode, s.version, s.note,
    coalesce(jsonb_agg(jsonb_build_object('id',b.id,'studentId',b.student_id,'studentName',st.name,'status',b.status,
      'cancelledAt',b.cancelled_at,'reason',b.reason,'sourceLessonId',b.source_lesson_id,'sourceNote',b.source_note)
      order by b.id) filter (where b.id is not null),'[]'::jsonb) as bookings
    from ${table(q,'sessions')} s join ${table(q,'tutors')} t on t.id=s.tutor_id
    left join ${table(q,'bookings')} b on b.session_id=s.id left join ${table(q,'students')} st on st.id=b.student_id
    where ${date && endDate ? q`s.starts_at >= ${date + 'T00:00:00+07:00'}::timestamptz and s.starts_at < ${endDate + 'T00:00:00+07:00'}::timestamptz` : date ? q`(s.starts_at at time zone 'Asia/Ho_Chi_Minh')::date = ${date}::date` : q`true`}
    group by s.id,t.name order by s.starts_at,s.id`;
  return rows.map(r=>({id:r.id,date:r.date,startTime:r.start_time,durationMin:r.duration_min,tutorId:r.tutor_id,tutorName:r.tutor_name,roomId:r.room_id,mode:r.mode,note:r.note,version:r.version,bookings:r.bookings}));
}
async function catalogs(q: Query) {
  const students = await q<Student[]>`select id,name from ${table(q,'students')} order by name`;
  const tutors = await q<Tutor[]>`select id,name,subject,phone from ${table(q,'tutors')} order by id`;
  const rooms = await q<{id:string}[]>`select id from ${table(q,'rooms')} order by id`;
  return { students:[...students], tutors:[...tutors], rooms:[...rooms] };
}
export async function getSchedule(date: string): Promise<ScheduleData> {
  // Consistent read snapshot: records, warnings and audit cannot straddle a write.
  return await db().begin('isolation level repeatable read read only', async tx=> {
    const sessions = await readSessions(tx,date);
    const options = await catalogs(tx);
    const changes = await tx`select id,session_id,action,before_snapshot,after_snapshot,occurred_at,reason,after_cutoff from ${table(tx,'schedule_changes')}
      where before_snapshot->>'date'=${date} or after_snapshot->>'date'=${date} order by recorded_at desc,id desc`;
    return {date,sessions,...options,warnings:detectWarnings(sessions),changes:changes.map(r=>({id:r.id,sessionId:r.session_id,action:r.action,before:r.before_snapshot,after:r.after_snapshot,occurredAt:new Date(r.occurred_at).toISOString(),reason:r.reason,afterCutoff:r.after_cutoff})) as ScheduleChange[],demoNow:DEMO_NOW,timezone:TIMEZONE};
  });
}
async function audit(q:Query, action:ScheduleChange['action'], before:Session|null, after:Session, reason?:string, bookingId?:string) {
  await q`insert into ${table(q,'schedule_changes')} (id,session_id,booking_id,action,before_snapshot,after_snapshot,occurred_at,reason,after_cutoff)
    values (${randomUUID()},${after.id},${bookingId??null},${action},${before? q.json(JSON.parse(JSON.stringify(before))) : null},${q.json(JSON.parse(JSON.stringify(after)))},${DEMO_NOW},${reason||null},${isAfterCutoff(DEMO_NOW,before?.date??null,after.date)})`;
}
function validCandidate(candidate:Session, all:Session[], closedDayConfirmed = false) {
  const warnings = blockingWarnings(validateSession(candidate,all.filter(s=>s.id!==candidate.id)),closedDayConfirmed);
  if(warnings.length) throw new ScheduleError(409,'SCHEDULE_CONFLICT',warnings[0].message,warnings);
}
function current(all:Session[], id:string, version:number) {
  const s=all.find(s=>s.id===id);
  if(!s) throw new ScheduleError(404,'NOT_FOUND','This session no longer exists.');
  if(s.version!==version) throw new ScheduleError(409,'STALE_VERSION','This session has changed. Reload its latest version before saving.');
  return s;
}
async function locked<T>(work:(tx:TransactionSql)=>Promise<T>):Promise<T> {
  return await db().begin('isolation level read committed',async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext(${schema()}), 72631)`;
    return await work(tx);
  }) as T;
}
function instant(s: {date:string;startTime:string}) { return `${s.date}T${s.startTime}:00+07:00`; }
export async function createSession(input:SessionInput) {
  return locked(async tx=>{
    const options=await catalogs(tx);
    const tutor=options.tutors.find(t=>t.id===input.tutorId);
    if(!tutor || !options.rooms.some(r=>r.id===input.roomId) || input.studentIds.some(id=>!options.students.some(s=>s.id===id))) throw new ScheduleError(404,'CATALOG_NOT_FOUND','A selected student, tutor or room does not exist.');
    const candidate:Session={id:randomUUID(),date:input.date,startTime:input.startTime,durationMin:input.durationMin,tutorId:input.tutorId,tutorName:tutor.name,roomId:input.roomId,mode:input.mode,note:input.note ?? '',version:1,bookings:input.studentIds.map(id=>({id:randomUUID(),studentId:id,studentName:options.students.find(s=>s.id===id)!.name,status:'booked',cancelledAt:null,reason:null,sourceLessonId:null,sourceNote:null}))};
    validCandidate(candidate,await readSessions(tx,input.date),input.closedDayConfirmed);
    await tx`insert into ${table(tx,'sessions')} (id,starts_at,ends_at,tutor_id,room_id,mode,version,note)
      values (${candidate.id},${instant(candidate)}::timestamptz,${instant(candidate)}::timestamptz + ${candidate.durationMin} * interval '1 minute',${candidate.tutorId},${candidate.roomId},${candidate.mode},1,${candidate.note ?? ''})`;
    for(const b of candidate.bookings) await tx`insert into ${table(tx,'bookings')} (id,session_id,student_id,status) values (${b.id},${candidate.id},${b.studentId},'booked')`;
    await audit(tx,'created',null,candidate,exceptionAuditReason(candidate.date,input.closedDayConfirmed,input.reason));
    return {id:candidate.id,version:1};
  });
}
export async function editSession(id:string,input:EditInput) {
  return locked(async tx=>{
    const all=await readSessions(tx);
    const before=current(all,id,input.expectedVersion);
    const policyError = editPolicyError(before, input);
    if (policyError) throw new ScheduleError(409, policyError.code, policyError.message);
    const options=await catalogs(tx);
    const tutor=options.tutors.find(t=>t.id===input.tutorId);
    if(!tutor || !options.rooms.some(r=>r.id===input.roomId)) throw new ScheduleError(404,'CATALOG_NOT_FOUND','The selected tutor or room does not exist.');
    const edits = input.bookings;
    if (edits && (new Set(edits.filter(b=>b.id).map(b=>b.id)).size !== edits.filter(b=>b.id).length || before.bookings.some(b=>!edits.some(e=>e.id===b.id)) || edits.some(b=>b.id && !before.bookings.some(old=>old.id===b.id)))) throw new ScheduleError(400,'INVALID_BOOKINGS','Existing bookings must be retained. Cancel a booking instead of removing its history.');
    if (edits && new Set(edits.map(b=>b.studentId)).size !== edits.length) throw new ScheduleError(400,'DUPLICATE_STUDENT','Choose different students for a pair.');
    if (edits?.some(b=>!options.students.some(s=>s.id===b.studentId))) throw new ScheduleError(404,'CATALOG_NOT_FOUND','A selected student no longer exists.');
    if (edits?.some(b=>before.bookings.some(old=>old.id!==b.id && old.studentId===b.studentId))) throw new ScheduleError(400,'BOOKING_IDENTITY','This student already has a booking in this session. Edit their existing booking instead.');
    const replacements=edits?.filter(e=>e.replacementStudentId) ?? [];
    const newStudents=[...(edits?.filter(e=>!e.id).map(e=>e.studentId) ?? []),...replacements.map(e=>e.replacementStudentId!)];
    if (replacements.some(e=>!e.id || !before.bookings.some(b=>b.id===e.id) || e.replacementStudentId===e.studentId)) throw new ScheduleError(400,'INVALID_BOOKINGS','Choose a different student for an existing booking.');
    if (new Set(newStudents).size!==newStudents.length || replacements.some(e=>before.bookings.some(b=>b.studentId===e.replacementStudentId))) throw new ScheduleError(400,'DUPLICATE_STUDENT','This student already has a booking here. Restore their existing booking instead.');
    if (newStudents.some(id=>!options.students.some(s=>s.id===id))) throw new ScheduleError(404,'CATALOG_NOT_FOUND','A selected student no longer exists.');
    const bookings = edits ? edits.flatMap(edit=>{
      const old=before.bookings.find(b=>b.id===edit.id);
      if (old && edit.replacementStudentId) return replaceBooking(old, options.students.find(s=>s.id===edit.replacementStudentId)!, randomUUID(), DEMO_NOW, input.reason);
      return {...old,id:old?.id ?? randomUUID(),studentId:edit.studentId,studentName:options.students.find(s=>s.id===edit.studentId)!.name,status:edit.status,cancelledAt:edit.status==='cancelled' ? old?.cancelledAt ?? DEMO_NOW : null,reason:edit.status!==old?.status ? input.reason : old?.reason ?? null,sourceLessonId:old?.sourceLessonId ?? null,sourceNote:old?.sourceNote ?? null};
    }) : before.bookings;
    const mode=input.mode ?? before.mode;
    if (mode==='one_to_one' && bookings.filter(b=>b.status!=='cancelled').length>1) throw new ScheduleError(400,'SESSION_CAPACITY','Cancel one booking before switching to one-to-one.');
    if (mode==='pair' && (bookings.length<2 || bookings.filter(b=>b.status!=='cancelled').length>2)) throw new ScheduleError(400,'SESSION_CAPACITY','Select a second student for a pair session.');
    const after:Session={...before,date:input.date,startTime:input.startTime,durationMin:input.durationMin,tutorId:input.tutorId,tutorName:tutor.name,roomId:input.roomId,bookings,mode,note:input.note ?? before.note ?? '',version:before.version+1};
    // Cancellation alone must remain possible even on an invalid imported session.
    const cancellationOnly = ['date','startTime','durationMin','tutorId','roomId','mode'].every(key=>before[key as keyof Session]===after[key as keyof Session]) && after.bookings.every(b=>{const old=before.bookings.find(o=>o.id===b.id)!;return !!old && b.studentId===old.studentId && (b.status===old.status || b.status==='cancelled');});
    if (!cancellationOnly) validCandidate(after,all,input.closedDayConfirmed);
    for(const b of after.bookings) {
      if(before.bookings.some(old=>old.id===b.id)) await tx`update ${table(tx,'bookings')} set student_id=${b.studentId},status=${b.status},cancelled_at=${b.cancelledAt},reason=${b.reason} where id=${b.id}`;
      else await tx`insert into ${table(tx,'bookings')} (id,session_id,student_id,status,cancelled_at,reason) values (${b.id},${id},${b.studentId},${b.status},${b.cancelledAt},${b.reason})`;
    }
    await tx`update ${table(tx,'sessions')} set starts_at=${instant(after)}::timestamptz,ends_at=${instant(after)}::timestamptz + ${after.durationMin} * interval '1 minute', tutor_id=${after.tutorId},room_id=${after.roomId},mode=${after.mode},note=${after.note ?? ''},version=${after.version} where id=${id}`;
    await audit(tx,'rescheduled',before,after,exceptionAuditReason(after.date,input.closedDayConfirmed,input.reason));
    return {id,version:after.version};
  });
}
export async function cancelBooking(id:string,input:CancelInput) {
  return locked(async tx=>{
    const all=await readSessions(tx);
    const found=all.find(s=>s.bookings.some(b=>b.id===id));
    if(!found) throw new ScheduleError(404,'NOT_FOUND','This booking does not exist.');
    const before=current(all,found.id,input.expectedVersion);
    const b=before.bookings.find(b=>b.id===id)!;
    if(b.status==='cancelled') throw new ScheduleError(409,'ALREADY_CANCELLED','This booking is already cancelled.');
    const after={...before,version:before.version+1,bookings:before.bookings.map(b=>b.id===id?{...b,status:'cancelled' as const,cancelledAt:DEMO_NOW,reason:input.reason}:b)};
    await tx`update ${table(tx,'bookings')} set status='cancelled',cancelled_at=${DEMO_NOW},reason=${input.reason} where id=${id}`;
    await tx`update ${table(tx,'sessions')} set version=${after.version} where id=${after.id}`;
    await audit(tx,'cancelled',before,after,input.reason,id);
    return {id:after.id,version:after.version};
  });
}

/** One bounded read for the month; warnings are calculated before UI filtering. */
export async function getMonthSchedule(date: string) {
  const { start, end } = monthBounds(date);
  const sessions = await readSessions(db(), start, end);
  return { month: date.slice(0, 7), sessions, warnings: detectWarnings(sessions) };
}
