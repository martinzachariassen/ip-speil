// Sorted range stores + binary search over the parsed geoip datasets. No I/O.

import { isIP } from "node:net";

import { ipv4ToUint32, ipv6ToBigInt } from "./parse.ts";

export interface Range<N, P> {
  start: N;
  end: N;
  payload: P;
}

// v4 ranges pack starts/ends into typed arrays for a compact, cache-friendly
// binary search; v6 needs full 128-bit precision so it uses bigint[] instead.
export interface RangesV4<P> {
  starts: Uint32Array;
  ends: Uint32Array;
  payloads: P[];
}

export interface RangesV6<P> {
  starts: bigint[];
  ends: bigint[];
  payloads: P[];
}

export function buildRangesV4<P>(entries: Range<number, P>[]): RangesV4<P> {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  return {
    starts: Uint32Array.from(sorted, (e) => e.start),
    ends: Uint32Array.from(sorted, (e) => e.end),
    payloads: sorted.map((e) => e.payload),
  };
}

export function buildRangesV6<P>(entries: Range<bigint, P>[]): RangesV6<P> {
  const sorted = [...entries].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return {
    starts: sorted.map((e) => e.start),
    ends: sorted.map((e) => e.end),
    payloads: sorted.map((e) => e.payload),
  };
}

// Greatest start <= ip, then verify ip <= its end. `?? 0` never fires: mid/ans
// are always in-bounds, so it only satisfies noUncheckedIndexedAccess typing.
export function lookupV4<P>(r: RangesV4<P>, ip: number): P | null {
  let lo = 0;
  let hi = r.starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if ((r.starts[mid] ?? 0) <= ip) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0 || ip > (r.ends[ans] ?? 0)) return null;
  return r.payloads[ans] ?? null;
}

export function lookupV6<P>(r: RangesV6<P>, ip: bigint): P | null {
  let lo = 0;
  let hi = r.starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if ((r.starts[mid] ?? 0n) <= ip) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0 || ip > (r.ends[ans] ?? 0n)) return null;
  return r.payloads[ans] ?? null;
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Map a 2-letter country code to an English name via the built-in Intl data. */
export function countryName(code?: string): string | undefined {
  if (!code) return undefined;
  try {
    return regionNames.of(code.toUpperCase());
  } catch {
    return undefined;
  }
}

export interface AsnPayload {
  asn?: number;
  country?: string;
  org?: string;
}

export interface CityPayload {
  country?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

// The merged local-lookup result. `countryCode` is DB-IP's (city) country;
// `asnCountry` is iptoasn's — kept separate so the cross-check can compare them.
export interface LocalGeo {
  countryCode?: string;
  country?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  asn?: number;
  asName?: string;
  org?: string;
  asnCountry?: string;
}

export class GeoDb {
  constructor(
    private readonly asnV4: RangesV4<AsnPayload>,
    private readonly asnV6: RangesV6<AsnPayload>,
    private readonly cityV4: RangesV4<CityPayload>,
    private readonly cityV6: RangesV6<CityPayload>,
  ) {}

  lookup(ip: string): LocalGeo | null {
    const version = isIP(ip);
    if (version === 0) return null;

    let asn: AsnPayload | null;
    let city: CityPayload | null;
    try {
      if (version === 4) {
        const n = ipv4ToUint32(ip);
        asn = lookupV4(this.asnV4, n);
        city = lookupV4(this.cityV4, n);
      } else {
        const n = ipv6ToBigInt(ip);
        asn = lookupV6(this.asnV6, n);
        city = lookupV6(this.cityV6, n);
      }
    } catch {
      return null;
    }

    if (!asn && !city) return null;

    const result: LocalGeo = {};
    if (city) {
      if (city.country) {
        result.countryCode = city.country;
        result.country = countryName(city.country);
      }
      result.region = city.region;
      result.city = city.city;
      result.lat = city.lat;
      result.lon = city.lon;
    }
    if (asn) {
      result.asn = asn.asn;
      result.asName = asn.org;
      result.org = asn.org;
      result.asnCountry = asn.country;
    }
    return result;
  }
}
