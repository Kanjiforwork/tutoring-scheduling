import { SchedulingBoard } from '@/components/scheduling-board';
import { isValidDate } from '@/lib/domain';
import { INITIAL_DATE } from '@/lib/contracts';
export default async function Home({searchParams}: {searchParams: Promise<{date?: string}>}) { const {date}=await searchParams; return <SchedulingBoard initialDate={date && isValidDate(date) ? date : INITIAL_DATE} />; }
