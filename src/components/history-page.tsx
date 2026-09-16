'use client';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, History } from 'lucide-react';
import { AppHeader } from './app-header';
import { Change } from './history-change';
import { dayCache } from '@/lib/schedule-cache';
import { useScheduleResource } from '@/hooks/use-schedule-resource';
import { isValidDate } from '@/lib/domain';
import { DEMO_NOW } from '@/lib/contracts';
export function HistoryPage({initialDate}: {initialDate: string}) {
  const [date,setDate]=useState(initialDate);
  const {data,loading,error,reload,refreshing}=useScheduleResource(dayCache,date);
  const choose=(next:string)=>{if(!isValidDate(next)) return; setDate(next); window.history.replaceState(null,'',`/history?date=${next}`);};
  const move=(days:number)=>{const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+days);choose(next.toISOString().slice(0,10));};
  const label=new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  return <><AppHeader date={date} active="history" /><main className="workspace history-workspace"><section className="day-heading"><div><p className="eyebrow">CHANGE HISTORY</p><h1>History</h1><p className="date-subtitle">Changes to lessons on {label}</p></div><a className="button secondary" href={`/?date=${date}`}>View schedule<ArrowRight size={16} /></a></section>
    <section className="board" aria-label="Schedule history"><div className="board-toolbar"><div className="date-controls"><div className="nav-group"><button className="button icon" aria-label="Previous day" onClick={()=>move(-1)}><ArrowLeft size={17}/></button><button className="button today" onClick={()=>choose(DEMO_NOW.slice(0,10))}>Today</button><button className="button icon" aria-label="Next day" onClick={()=>move(1)}><ArrowRight size={17}/></button></div><label className="date-input"><span className="sr-only">Lesson date</span><input type="date" value={date} onChange={e=>choose(e.target.value)}/></label></div><div className="schedule-totals"><span><strong>{data?.changes.length ?? '—'}</strong> {data?.changes.length === 1 ? 'change' : 'changes'}</span><button className="button icon" aria-label="Refresh history" disabled={loading||refreshing} onClick={()=>void reload()}><RefreshCw size={16} className={refreshing?'spin':''}/></button></div></div>
    {error && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={()=>void reload()}>Retry</button></div>}
    {loading ? <div className="empty-state" role="status">Loading history…</div> : data && <div className="history-page-body">{data.changes.length ? data.changes.map(change=><Change key={change.id} change={change} date={date}/>) : <div className="empty-state"><History size={26}/><h2>No changes for this day</h2><p>Saved edits and cancellations will appear here.</p></div>}</div>}
    </section></main></>;
}
