import postgres from 'postgres';

// This module is only imported by route handlers and Node scripts.
let connection: ReturnType<typeof postgres> | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return connection ??= postgres(process.env.DATABASE_URL, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15, ssl: 'require' });
}
export function schema() {
  const value = process.env.DB_SCHEMA || 'bright_path';
  if (!/^bright_path(?:_test(?:_[a-z0-9]+)?)?$/.test(value)) throw new Error('Unexpected database schema');
  return value;
}
export async function closeDb() { if (connection) await connection.end(); connection = undefined; }
