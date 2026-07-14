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
    // Don't evict on expiry — getStale() needs the value to survive so a
    // budget-exhausted request can still serve something. prune() reclaims it.
    if (Date.now() > hit.expiresAt) return undefined;
    return hit.value;
  }

  // Ignores expiry — used to serve a stale value when the daily budget is spent
  // rather than failing the request outright.
  getStale(key: string): T | undefined {
    return this.store.get(key)?.value;
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
// cold cache under load makes a single upstream request, not one per caller.
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

export class DailyBudget {
  private day = "";
  private count = 0;

  constructor(private readonly limit: number) {}

  private roll(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
    }
  }

  tryConsume(): boolean {
    this.roll();
    if (this.count >= this.limit) return false;
    this.count += 1;
    return true;
  }

  get remaining(): number {
    this.roll();
    return Math.max(0, this.limit - this.count);
  }
}

export class BudgetExhaustedError extends Error {
  constructor() {
    super("daily upstream budget exhausted");
    this.name = "BudgetExhaustedError";
  }
}

export interface CachedFetcherOptions {
  ttlMs: number;
  maxEntries?: number;
  budget?: DailyBudget;
}

// cache → single-flight → budget → load. The budget is only charged when an
// actual upstream load runs (once per coalesced key), never on a cache hit.
export function createCachedFetcher<T>({ ttlMs, maxEntries, budget }: CachedFetcherOptions) {
  const cache = new TtlCache<T>(ttlMs, maxEntries);
  const flight = createSingleFlight<T>();

  return (key: string, load: () => Promise<T>): Promise<T> => {
    const fresh = cache.get(key);
    if (fresh !== undefined) return Promise.resolve(fresh);

    return flight(key, async () => {
      const filled = cache.get(key);
      if (filled !== undefined) return filled;

      if (budget && !budget.tryConsume()) {
        const stale = cache.getStale(key);
        if (stale !== undefined) return stale;
        throw new BudgetExhaustedError();
      }

      const value = await load();
      cache.set(key, value);
      return value;
    });
  };
}
