import { type FetchLike, fetchJson } from "./fetch.ts";
import type { GeoCrossCheck, GeoSource, IpInfo } from "./ip-lookup.ts";

export interface GeoSourcesDeps {
  fetchImpl: FetchLike;
  timeoutMs: number;
}

interface IpwhoResponse {
  success?: boolean;
  country?: string;
  country_code?: string;
  city?: string;
  connection?: { asn?: number };
}

interface GeojsResponse {
  country?: string;
  country_code?: string;
  city?: string;
  asn?: number;
}

async function fromIpwho(ip: string, deps: GeoSourcesDeps): Promise<GeoSource | null> {
  try {
    const d = await fetchJson<IpwhoResponse>(
      deps.fetchImpl,
      `https://ipwho.is/${encodeURIComponent(ip)}`,
      deps.timeoutMs,
    );
    if (d.success === false) return null;
    return {
      name: "ipwho.is",
      country: d.country,
      countryCode: d.country_code,
      city: d.city,
      asn: d.connection?.asn != null ? `AS${d.connection.asn}` : undefined,
    };
  } catch {
    return null;
  }
}

async function fromGeojs(ip: string, deps: GeoSourcesDeps): Promise<GeoSource | null> {
  try {
    const d = await fetchJson<GeojsResponse>(
      deps.fetchImpl,
      `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,
      deps.timeoutMs,
    );
    return {
      name: "geojs.io",
      country: d.country,
      countryCode: d.country_code,
      city: d.city,
      asn: d.asn != null ? `AS${d.asn}` : undefined,
    };
  } catch {
    return null;
  }
}

// Fans out to keyless secondary providers and reports how many sources agree on
// the country. Both are best-effort; a provider that errors is simply dropped.
export async function crossCheckGeo(
  info: IpInfo,
  deps: GeoSourcesDeps,
): Promise<GeoCrossCheck | undefined> {
  const ip = info.query;
  if (!ip) return undefined;

  const secondary = (await Promise.all([fromIpwho(ip, deps), fromGeojs(ip, deps)])).filter(
    (source): source is GeoSource => source !== null,
  );

  const primary: GeoSource = {
    name: "ipapi.is",
    country: info.country,
    countryCode: info.countryCode,
    city: info.city,
    asn: info.as,
  };
  const sources = [primary, ...secondary];
  const cc = info.countryCode?.toUpperCase();
  const agree = cc ? sources.filter((s) => s.countryCode?.toUpperCase() === cc).length : 0;

  return { agree, total: sources.length, countryCode: info.countryCode, sources };
}
