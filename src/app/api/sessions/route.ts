import { createSession } from '@/lib/server/service';
import { createSchema } from '@/lib/server/validation';
import { respond,jsonBody } from '@/lib/server/http';
export const runtime='nodejs';
export async function POST(request:Request) { return respond(async()=>createSession(createSchema.parse(await jsonBody(request))),201); }
