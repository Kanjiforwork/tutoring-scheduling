import { cancelBooking } from '@/lib/server/service';
import { cancelSchema } from '@/lib/server/validation';
import { respond,jsonBody } from '@/lib/server/http';
export const runtime='nodejs';
export async function POST(request:Request,context:{params:Promise<{id:string}>}) { return respond(async()=>cancelBooking((await context.params).id,cancelSchema.parse(await jsonBody(request)))); }
