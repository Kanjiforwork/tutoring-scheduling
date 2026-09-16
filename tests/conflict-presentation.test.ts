import { expect, it } from 'vitest';
import { presentConflict } from '../src/lib/conflict-presentation';
import type { Warning } from '../src/lib/contracts';
const warning: Warning = {code:'STUDENT_OVERLAP', message:'L007 and L008 overlap', sessionIds:['internal-session'], bookingIds:[], sourceLessonIds:['L007','L008']};
it('keeps source identifiers out of fallback warning copy', () => {
  for (const code of ['STUDENT_OVERLAP','ROOM_OVERLAP','TUTOR_DAILY_LIMIT','UNKNOWN']) {
    const result = presentConflict({...warning,code},[]);
    expect(JSON.stringify(result)).not.toMatch(/L007|L008|internal-session/);
    expect(result.title).toBeTruthy();
    expect(result.action).toBeTruthy();
  }
});
