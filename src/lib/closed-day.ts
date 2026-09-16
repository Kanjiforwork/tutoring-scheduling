import { POLICY, type Warning } from './contracts';

export function isClosedDay(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T12:00:00Z`).getUTCDay() === POLICY.closedWeekday;
}

/** Confirmation waives only the closed-day rule, never collisions or load limits. */
export function blockingWarnings(warnings: Warning[], closedDayConfirmed = false): Warning[] {
  return warnings.filter(warning => !(closedDayConfirmed && warning.code === 'CLOSED_DAY'));
}

export function exceptionAuditReason(date: string, confirmed: boolean | undefined, reason?: string): string | undefined {
  return confirmed && isClosedDay(date) ? ['Closed-day exception confirmed.', reason?.trim()].filter(Boolean).join(' ') : reason;
}
