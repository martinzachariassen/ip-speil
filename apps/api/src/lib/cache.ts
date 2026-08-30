interface Entry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 5000;

// Bounded TTL map. `maxEntries` is a hard ceiling, not a hint: expiry alone
// can't bound a cache whose TTL outlives the traffic that fills it (the routing
// cache holds a network block for six hours), so once the expired entries are
// gone the oldest live ones go too.
export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
  ) {}

  get size(): number {
    return this.store.size;
  }

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    // Re-inserting moves the key to the tail, so a key that keeps being written
    // is not evicted for being old.
    this.store.delete(key);
    if (this.store.size >= this.maxEntries) this.evict();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  // Expired entries first; if that doesn't get under the ceiling, the oldest
  // insertions go. A Map iterates in insertion order, so its first key is the
  // oldest one.
  private evict(): void {
    const now = Date.now();
    for (const [k, e] of this.store) if (now > e.expiresAt) this.store.delete(k);

    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (oldest.done) return;
      this.store.delete(oldest.value);
    }
  }
}

// Coalesces concurrent calls for the same key onto one in-flight promise so a
// cold cache under load runs a single load, not one per caller.
export function createSingleFlight<T>() {
  const inflight = new Map<string, Promise<T>>();
  return (key: string, run: () => Promise<T>): Promise<T> => {
    const existing = inflight.get(key);
    if (existing) return existing;
    const promise = run().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  };
}

export interface CachedFetcherOptions {
  ttlMs: number;
  maxEntries?: number;
}

// cache → single-flight → load. Wraps the local enrichment pipeline so repeat and
// concurrent lookups for the same IP reuse one result (the reverse-DNS / DNSBL
// resolver calls are the only per-request work left).
export function createCachedFetcher<T>({ ttlMs, maxEntries }: CachedFetcherOptions) {
  const cache = new TtlCache<T>(ttlMs, maxEntries);
  const flight = createSingleFlight<T>();

  return (key: string, load: () => Promise<T>): Promise<T> => {
    const fresh = cache.get(key);
    if (fresh !== undefined) return Promise.resolve(fresh);

    return flight(key, async () => {
      const filled = cache.get(key);
      if (filled !== undefined) return filled;

      const value = await load();
      cache.set(key, value);
      return value;
    });
  };
}
