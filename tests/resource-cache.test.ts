import { describe, expect, it, vi } from 'vitest';
import { ResourceCache } from '../src/lib/resource-cache';

describe('schedule resource cache', () => {
  it('deduplicates prefetch and foreground requests and reuses fresh data', async () => {
    let resolve!: (value: string) => void;
    const loader = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    const cache = new ResourceCache(loader);
    const first = cache.load('day');
    const second = cache.load('day');
    expect(loader).toHaveBeenCalledTimes(1);
    resolve('schedule');
    expect(await first).toBe('schedule');
    expect(await second).toBe('schedule');
    expect(await cache.load('day')).toBe('schedule');
    expect(loader).toHaveBeenCalledTimes(1);
  });
  it('keeps visible data while refreshing and updates subscribers on success', async () => {
    const loader = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    const cache = new ResourceCache<string>(loader);
    const changed = vi.fn(); cache.subscribe(changed);
    await cache.load('day');
    const refresh = cache.load('day', true);
    expect(cache.peek('day')).toBe('old');
    await refresh;
    expect(cache.peek('day')).toBe('new');
    expect(changed).toHaveBeenCalledTimes(2);
  });
  it('prevents pre-mutation responses from restoring invalidated data', async () => {
    let finishOld!: (value: string) => void;
    const loader = vi.fn().mockImplementationOnce(() => new Promise<string>(resolve => { finishOld = resolve; })).mockResolvedValue('new');
    const cache = new ResourceCache<string>(loader);
    const pending = cache.load('day');
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    cache.clear();
    expect(loader.mock.calls[0][1].aborted).toBe(true);
    await cache.load('day');
    finishOld('old');
    await rejected;
    expect(cache.peek('day')).toBe('new');
  });
  it('retries failed prefetches and refreshes expired entries', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('first').mockResolvedValueOnce('updated');
    const cache = new ResourceCache<string>(loader, -1);
    await expect(cache.load('day')).rejects.toThrow('offline');
    expect(cache.peek('day')).toBeUndefined();
    expect(await cache.load('day')).toBe('first');
    expect(await cache.load('day')).toBe('updated');
  });
});
