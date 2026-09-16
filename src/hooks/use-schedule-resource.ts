'use client';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ResourceCache } from '@/lib/resource-cache';
const serverSnapshot = () => 0;
export function useScheduleResource<T>(cache: ResourceCache<T>, key: string) {
  useSyncExternalStore(cache.subscribe, cache.snapshot, serverSnapshot);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const reload = useCallback(async () => {
    setFailure(null); setRefreshingKey(key);
    try { await cache.load(key, true); return true; }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailure({ key, message: error instanceof Error ? error.message : 'Unable to load the schedule.' });
      return false;
    } finally { setRefreshingKey(current => current === key ? null : current); }
  }, [cache, key]);
  useEffect(() => {
    let active = true;
    setFailure(null);
    const load = () => { void cache.load(key).catch(error => {
      if (active && !(error instanceof DOMException && error.name === 'AbortError')) setFailure({ key, message: error instanceof Error ? error.message : 'Unable to load the schedule.' });
    }); };
    load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); };
  }, [cache, key]);
  const data = cache.peek(key) ?? null;
  const error = failure?.key === key ? failure.message : '';
  return { data, error, loading: !data && !error, refreshing: refreshingKey === key, reload };
}
