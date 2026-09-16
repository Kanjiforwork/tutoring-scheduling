import { readFileSync } from 'node:fs';
import postgres from 'postgres';
const schema=process.env.DB_SCHEMA||'bright_path';
if(!/^bright_path(?:_test)?$/.test(schema)) throw new Error('Unsupported schema');
if(!process.env.MIGRATION_DATABASE_URL) throw new Error('MIGRATION_DATABASE_URL with schema-owner privileges is required; the runtime role cannot migrate.');
const sql=postgres(process.env.MIGRATION_DATABASE_URL,{ssl:'require',prepare:false,max:1});
try { await sql.begin(async tx=>{await tx.unsafe(readFileSync('scripts/schema.sql','utf8').replaceAll('__SCHEMA__',schema));}); console.log('Schema ready:',schema); }
finally { await sql.end(); }
