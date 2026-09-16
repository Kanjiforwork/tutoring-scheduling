/** Calendar arithmetic uses UTC dates, independent of the browser timezone. */
export function shiftDay(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function weekDates(date: string): string[] {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = shiftDay(date, -((day + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDay(monday, index));
}
export function shiftMonth(date: string, delta: number): string {
  const value = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + delta);
  const last = new Date(value);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  value.setUTCDate(Math.min(Number(date.slice(8)), last.getUTCDate()));
  return value.toISOString().slice(0, 10);
}
export function monthBounds(date: string) {
  const start = `${date.slice(0, 7)}-01`;
  return { start, end: shiftMonth(start, 1) };
}
export function monthDates(date: string): string[] {
  const { start, end } = monthBounds(date);
  const first = weekDates(start)[0];
  const last = weekDates(shiftDay(end, -1))[6];
  const count = Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1;
  return Array.from({ length: count }, (_, i) => shiftDay(first, i));
}
