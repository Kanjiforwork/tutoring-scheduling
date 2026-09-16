import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v+'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === v; }, 'Enter a real calendar date');
const fields = {
  date,
  note: z.string().trim().max(1000).optional(),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  durationMin: z.union([z.literal(60), z.literal(90)]),
  tutorId: z.string().min(1).max(100),
  roomId: z.string().min(1).max(100),
};
export const dateSchema = date;
export const createSchema = z.object({ ...fields, mode: z.enum(['one_to_one','pair']), studentIds: z.array(z.string().min(1).max(100)).min(1).max(2), reason: z.string().trim().max(500).optional() }).strict().superRefine((v,ctx)=>{
  if(v.studentIds.length !== (v.mode === 'pair' ? 2 : 1)) ctx.addIssue({code:'custom',path:['studentIds'],message:'Select one student for one-to-one or two students for a pair.'});
  if(new Set(v.studentIds).size !== v.studentIds.length) ctx.addIssue({code:'custom',path:['studentIds'],message:'A pair needs two different students.'});
});
export const editSchema = z.object({ ...fields, mode: z.enum(['one_to_one','pair']).optional(), bookings: z.array(z.object({ id: z.string().min(1).optional(), studentId: z.string().min(1), status: z.enum(['booked','cancelled','no_show']) }).strict()).min(1).max(2).optional(), expectedVersion:z.number().int().positive(), reason:z.string().trim().min(1,'A reason is required').max(500) }).strict();
export const cancelSchema = z.object({expectedVersion:z.number().int().positive(),reason:z.string().trim().min(1,'A reason is required').max(500)}).strict();
