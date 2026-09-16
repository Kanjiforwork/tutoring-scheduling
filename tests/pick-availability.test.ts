import { describe, it, expect } from 'vitest';
import { pickAvailability } from '../src/lib/pick-availability';
import type { Session } from '../src/lib/contracts';
const draft = {date:'2026-03-04',startTime:'09:00',durationMin:60};
const lesson: Session = {...draft,id:'existing',tutorId:'T1',tutorName:'Tutor',roomId:'R1',mode:'one_to_one',version:1,bookings:[{id:'B1',studentId:'S1',studentName:'Student',status:'booked',cancelledAt:null,reason:null,sourceLessonId:null,sourceNote:null}]};
describe('availability beside picker options', () => {
  it('reports conflicts for each resource and permits adjacent intervals', () => {
    for (const [kind,id] of [['student','S1'],['tutor','T1'],['room','R1']] as const) {
      expect(pickAvailability([lesson],draft,kind,id)).toBe('Busy 09:00–10:00');
      expect(pickAvailability([lesson],{...draft,startTime:'10:00'},kind,id)).toBeUndefined();
    }
  });
  it('excludes the edited session and other dates', () => {
    expect(pickAvailability([lesson],draft,'room','R1','existing')).toBeUndefined();
    expect(pickAvailability([lesson],{...draft,date:'2026-03-05'},'room','R1')).toBeUndefined();
  });
  it('ignores cancellations, retains no-shows, and permits cancellation drafts', () => {
    const cancelled = {...lesson,bookings:lesson.bookings.map(b=>({...b,status:'cancelled' as const}))};
    expect(pickAvailability([cancelled],draft,'student','S1')).toBeUndefined();
    expect(pickAvailability([{...lesson,bookings:lesson.bookings.map(b=>({...b,status:'no_show' as const}))}],draft,'student','S1')).toContain('Busy');
    expect(pickAvailability([lesson],draft,'student','S1',undefined,0)).toBeUndefined();
  });
  it('counts pair bookings toward the daily tutor limit even without overlap', () => {
    const five=Array.from({length:5},(_,i)=>({...lesson,id:String(i),startTime:`${10+i}:00`}));
    expect(pickAvailability(five,draft,'tutor','T1',undefined,1)).toBeUndefined();
    expect(pickAvailability(five,draft,'tutor','T1',undefined,2)).toBe('7/6 bookings with this session');
  });
  it('rechecks overlap when duration changes and rejects incomplete time context', () => {
    const later={...lesson,startTime:'10:00'};
    expect(pickAvailability([later],draft,'room','R1')).toBeUndefined();
    expect(pickAvailability([later],{...draft,durationMin:90},'room','R1')).toBe('Busy 10:00–11:00');
    expect(pickAvailability([later],{...draft,date:''},'room','R1')).toBe('Choose a date and time first');
  });
});
