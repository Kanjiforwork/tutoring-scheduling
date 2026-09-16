import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ScheduleError } from './service';
export async function respond(work:()=>Promise<unknown>,status=200) {
  try { return NextResponse.json(await work(),{status,headers:{'Cache-Control':'no-store'}}); }
  catch(error) {
    if(error instanceof ZodError) return NextResponse.json({error:{code:'INVALID_INPUT',message:'Check the highlighted fields.',fieldErrors:error.flatten().fieldErrors}},{status:400});
    if(error instanceof SyntaxError) return NextResponse.json({error:{code:'INVALID_JSON',message:'The request body is not valid JSON.'}},{status:400});
    if(error instanceof ScheduleError) return NextResponse.json({error:{code:error.code,message:error.message,conflicts:error.conflicts}},{status:error.status});
    console.error('Schedule operation failed',error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({error:{code:'SERVER_ERROR',message:'Unable to complete this request. Please reload the schedule before trying again.'}},{status:503});
  }
}
export async function jsonBody(request:Request) {
  if(!request.headers.get('content-type')?.includes('application/json')) throw new ScheduleError(400,'INVALID_CONTENT_TYPE','Send JSON input.');
  const text=await request.text();
  if(text.length>16_384) throw new ScheduleError(400,'INPUT_TOO_LARGE','This request is too large.');
  return JSON.parse(text);
}
