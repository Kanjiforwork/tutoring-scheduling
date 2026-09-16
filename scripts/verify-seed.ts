import assert from 'node:assert/strict';
import { seed } from './seed';
import { db, closeDb } from '../src/lib/server/db';
// Verification writes only to the isolated schema. Keep fixtures and the edited marker.
if(process.env.TEST_DB_SCHEMA!=='bright_path_test') throw new Error('Set the isolated test schema explicitly');
process.env.DB_SCHEMA='bright_path_test';
process.env.DATABASE_URL=process.env.MIGRATION_DATABASE_URL || process.env.TEST_DATABASE_URL;
const marker='Seed rerun must preserve this test-only edited note';
try {
  await seed();
  await db()`update bright_path_test.bookings set source_note=${marker} where source_lesson_id='L001'`;
  await seed();
  const [counts]=await db()`select count(*)::int as count, count(distinct source_lesson_id)::int as distinct_count from bright_path_test.bookings where source_lesson_id is not null`;
  const [booking]=await db()`select source_note from bright_path_test.bookings where source_lesson_id='L001'`;
  assert.equal(counts.count,34); assert.equal(counts.distinct_count,34); assert.equal(booking.source_note,marker);
  console.log('Seed verified: 34 unique source bookings; rerun preserves existing user edits.');
} finally { await closeDb(); }
