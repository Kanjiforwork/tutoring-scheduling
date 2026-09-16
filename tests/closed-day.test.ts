import { expect, it } from 'vitest';
import { blockingWarnings, exceptionAuditReason, isClosedDay } from '../src/lib/closed-day';
import { createSchema, editSchema } from '../src/lib/server/validation';
import type { Warning } from '../src/lib/contracts';
const warnings=['CLOSED_DAY','STUDENT_OVERLAP','TUTOR_OVERLAP','ROOM_OVERLAP','TUTOR_DAILY_LIMIT','OUTSIDE_HOURS'].map(code=>({code,message:code,sessionIds:[],bookingIds:[],sourceLessonIds:[]} as Warning));
it('requires explicit confirmation and only waives the closed-day rule',()=>{
  expect(blockingWarnings(warnings)).toEqual(warnings);
  expect(blockingWarnings(warnings,false)).toEqual(warnings);
  expect(blockingWarnings(warnings,true).map(w=>w.code)).toEqual(warnings.slice(1).map(w=>w.code));
});
it('uses the lesson date and records the confirmed exception without losing the reason',()=>{
  expect(isClosedDay('2026-03-02')).toBe(true);
  expect(isClosedDay('2026-03-03')).toBe(false);
  expect(exceptionAuditReason('2026-03-02',true,'Family requested Monday')).toBe('Closed-day exception confirmed. Family requested Monday');
  expect(exceptionAuditReason('2026-03-03',true,'Change')).toBe('Change');
  expect(exceptionAuditReason('2026-03-02',false)).toBeUndefined();
});
it('accepts only a boolean confirmation in create and edit contracts',()=>{
  const input={date:'2026-03-02',startTime:'09:00',durationMin:60,tutorId:'t',roomId:'r'};
  expect(createSchema.safeParse({...input,mode:'one_to_one',studentIds:['s'],closedDayConfirmed:true}).success).toBe(true);
  expect(editSchema.safeParse({...input,expectedVersion:1,reason:'Change',closedDayConfirmed:true}).success).toBe(true);
  expect(createSchema.safeParse({...input,mode:'one_to_one',studentIds:['s'],closedDayConfirmed:'true'}).success).toBe(false);
});
