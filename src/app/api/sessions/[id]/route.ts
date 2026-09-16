import { editSession } from '@/lib/server/service';
import { editSchema } from '@/lib/server/validation';
import { respond,jsonBody } from '@/lib/server/http';
export const runtime='nodejs';
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}) { return respond(async()=>editSession((await context.params).id,editSchema.parse(await jsonBody(request)))); }
