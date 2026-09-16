import { getSchedule } from '@/lib/server/service';
import { dateSchema } from '@/lib/server/validation';
import { respond } from '@/lib/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) { return respond(()=>getSchedule(dateSchema.parse(new URL(request.url).searchParams.get('date')))); }
