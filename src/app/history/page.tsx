export const metadata = { title: 'Bright Path · History' };
import { HistoryPage } from '@/components/history-page';
import { isValidDate } from '@/lib/domain';
import { INITIAL_DATE } from '@/lib/contracts';
export default async function Page({searchParams}: {searchParams: Promise<{date?: string}>}) { const {date}=await searchParams; return <HistoryPage initialDate={date && isValidDate(date) ? date : INITIAL_DATE} />; }
