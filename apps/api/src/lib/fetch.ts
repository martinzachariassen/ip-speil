export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function fetchJson<T>(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
): Promise<T> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${url} responded with ${res.status}`);
  return (await res.json()) as T;
}
