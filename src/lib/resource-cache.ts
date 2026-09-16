/** In-memory, bounded cache. Invalidated requests can never repopulate it. */
export class ResourceCache<T> {
  private entries = new Map<string, { data: T; at: number }>();
  private pending = new Map<string, Promise<T>>();
  private controllers = new Set<AbortController>();
  private listeners = new Set<() => void>();
  private generation = 0;
  private version = 0;
  constructor(private loader: (key: string, signal: AbortSignal) => Promise<T>, private ttl = 60_000) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.version;
  private emit() { this.version++; this.listeners.forEach(listener => listener()); }
  peek(key: string) { return this.entries.get(key)?.data; }
  async load(key: string, force = false): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    const cached = this.entries.get(key);
    if (!force && cached && Date.now() - cached.at < this.ttl) return cached.data;
    const generation = this.generation;
    const controller = new AbortController();
    this.controllers.add(controller);
    const request = this.loader(key, controller.signal).then(data => {
      if (generation !== this.generation) throw new DOMException('Invalidated', 'AbortError');
      this.entries.delete(key);
      this.entries.set(key, { data, at: Date.now() });
      if (this.entries.size > 42) this.entries.delete(this.entries.keys().next().value!);
      this.emit();
      return data;
    }).finally(() => {
      this.controllers.delete(controller);
      if (this.pending.get(key) === request) this.pending.delete(key);
    });
    this.pending.set(key, request);
    return request;
  }
  clear() {
    this.generation++;
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear(); this.pending.clear(); this.entries.clear(); this.emit();
  }
}
