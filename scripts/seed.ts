import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { db, schema, closeDb } from '../src/lib/server/db';
// These source CSVs contain simple, unquoted fields. Fail closed if that format changes.
function csv(path:string) {
  const text=readFileSync(path,'utf8').trim();
  if(text.includes('"')) throw new Error('Quoted CSV fields require a CSV parser');
  const [head,...rows]=text.split(/\r?\n/); const keys=head.split(',');
  return rows.map(line=>{const cells=line.split(',');if(cells.length!==keys.length)throw new Error('Unexpected CSV shape');return Object.fromEntries(keys.map((key,i)=>[key,cells[i]]));});
}
export async function seed() {
  const lessons=csv('ref/lessons_export.csv'), tutors=csv('ref/tutors.csv');
  const names=[...new Set(lessons.map(l=>l.student))];
  const students=new Map(names.map((name,i)=>[name,`student-${String(i+1).padStart(3,'0')}`]));
  if(process.env.MIGRATION_DATABASE_URL) process.env.DATABASE_URL=process.env.MIGRATION_DATABASE_URL;
  const sql=db(), ns=schema();
  await sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtext(${ns}),72631)`;
    await tx`insert into ${tx(ns+'.students')} ${tx([...students].map(([name,id])=>({id,name})))} on conflict do nothing`;
    await tx`insert into ${tx(ns+'.tutors')} ${tx(tutors.map(t=>({id:t.tutor_id,name:t.tutor_name,subject:t.subject,phone:t.phone})))} on conflict do nothing`;
    await tx`insert into ${tx(ns+'.rooms')} ${tx(Array.from({length:6},(_,i)=>({id:'R'+(i+1)})))} on conflict do nothing`;
    const sessions=lessons.filter(l=>l.lesson_id!=='L010').map(l=>{
      const start=new Date(`${l.date}T${l.start_time}:00+07:00`);
      return {id:'seed-'+l.lesson_id,starts_at:start.toISOString(),ends_at:new Date(start.getTime()+Number(l.duration_min)*60000).toISOString(),tutor_id:l.tutor_id,room_id:l.room,mode:l.lesson_id==='L009'?'pair':'one_to_one'};
    });
    await tx`insert into ${tx(ns+'.sessions')} ${tx(sessions)} on conflict do nothing`;
    const bookings=lessons.map(l=>({id:'booking-'+l.lesson_id,session_id:'seed-'+(l.lesson_id==='L010'?'L009':l.lesson_id),student_id:students.get(l.student)!,status:l.status,cancelled_at:l.cancelled_at||null,reason:l.status==='cancelled'?l.note||null:null,source_lesson_id:l.lesson_id,source_note:l.note||null}));
    await tx`insert into ${tx(ns+'.bookings')} ${tx(bookings)} on conflict do nothing`;
  });
  console.log('Seed complete; existing records preserved.');
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) seed().finally(closeDb);
