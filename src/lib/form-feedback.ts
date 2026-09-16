import type { ApiError } from './contracts';

export function errorMessages(error: ApiError): string[] {
  return [...new Set([error.message, ...(error.conflicts ?? []).map(conflict => conflict.message)])];
}

/** Editing cannot resolve an uncertain save or a stale server snapshot. */
export function afterDraftChange(error: ApiError | null): ApiError | null {
  return error && ['INVALID_INPUT', 'SCHEDULE_CONFLICT', 'DUPLICATE_STUDENT', 'BOOKING_IDENTITY', 'SESSION_CAPACITY'].includes(error.code) ? null : error;
}
