import type { ConflictPresentation } from './conflict-presentation';
export type BookingStatus = 'booked' | 'cancelled' | 'no_show';
export type SessionMode = 'one_to_one' | 'pair';
export interface Student { id: string; name: string }
export interface Tutor { id: string; name: string; subject: string; phone: string }
export interface Room { id: string }
export interface Booking { id: string; studentId: string; studentName: string; status: BookingStatus; cancelledAt: string | null; reason: string | null; sourceLessonId: string | null; sourceNote: string | null }
export interface Session { note?: string; id: string; date: string; startTime: string; durationMin: number; tutorId: string; tutorName: string; roomId: string; mode: SessionMode; version: number; bookings: Booking[] }
export interface Warning { presentation?: ConflictPresentation; code: string; message: string; sessionIds: string[]; bookingIds: string[]; sourceLessonIds: string[] }
export interface ScheduleChange { id: string; sessionId: string; action: 'created' | 'rescheduled' | 'cancelled'; before: Session | null; after: Session; occurredAt: string; reason: string | null; afterCutoff: boolean }
export interface ScheduleData { date: string; sessions: Session[]; students: Student[]; tutors: Tutor[]; rooms: Room[]; warnings: Warning[]; changes: ScheduleChange[]; demoNow: string; timezone: string }
export interface SessionInput { closedDayConfirmed?: boolean; note?: string; date: string; startTime: string; durationMin: 60 | 90; tutorId: string; roomId: string; mode: SessionMode; studentIds: string[]; reason?: string }
export interface BookingEdit { replacementStudentId?: string; id?: string; studentId: string; status: BookingStatus }
export interface EditInput { closedDayConfirmed?: boolean; note?: string; mode?: SessionMode; bookings?: BookingEdit[]; date: string; startTime: string; durationMin: 60 | 90; tutorId: string; roomId: string; expectedVersion: number; reason: string }
export interface CancelInput { expectedVersion: number; reason: string }
export interface ApiError { code: string; message: string; fieldErrors?: Record<string, string[]>; conflicts?: Warning[] }
export const DEMO_NOW = '2026-03-03T17:00:00+07:00';
export const INITIAL_DATE = '2026-03-04';
export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const POLICY = { opensAt: '09:00', closesAt: '22:00', maxBookings: 6, durations: [60, 90], closedWeekday: 1 } as const;
