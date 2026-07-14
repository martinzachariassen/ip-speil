import type { HeaderMap, IpInfo } from "./types.ts";

export async function fetchInfo(ip?: string): Promise<IpInfo> {
  const url = ip ? `/api/info?ip=${encodeURIComponent(ip)}` : "/api/info";
  try {
    const r = await fetch(url);
    return (await r.json()) as IpInfo;
  } catch {
    return {};
  }
}

export async function fetchHeaders(): Promise<HeaderMap> {
  try {
    const r = await fetch("/api/headers");
    return (await r.json()) as HeaderMap;
  } catch {
    return {};
  }
}
