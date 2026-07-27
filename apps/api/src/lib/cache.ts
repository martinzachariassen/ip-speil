interface Entry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 5000;

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) return undefined;
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) this.prune();
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private prune(): void {
    const now = Date.now();
    for (const [k, e] of this.store) if (now > e.expiresAt) this.store.delete(k);
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
