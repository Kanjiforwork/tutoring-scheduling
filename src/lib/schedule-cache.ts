'use client';
import type { ScheduleData, Session, Warning } from './contracts';
import { ResourceCache } from './resource-cache';
export type MonthData = { month: string; sessions: Session[]; warnings: Warning[] };
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || 'Unable to load the schedule.');
  return payload;
}
export const dayCache = new ResourceCache<ScheduleData>((date, signal) => read(`/api/schedule?date=${date}`, signal));
export const monthCache = new ResourceCache<MonthData>((month, signal) => read(`/api/schedule/month?date=${month}-01`, signal));
export function invalidateSchedule() { dayCache.clear(); monthCache.clear(); }
