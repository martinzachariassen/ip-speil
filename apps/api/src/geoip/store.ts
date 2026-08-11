// Sorted range stores + binary search over the parsed geoip datasets. No I/O.
//
// Ranges and their per-row fields (country/region/city/lat/lon, asn/org) are kept
// as parallel typed arrays in start-sorted order — a lookup returns a row index,
// and the caller reads whichever columns it needs (with pooled strings resolved
// only for the one matched row, not for all 7.9M rows up front). This is the
// piece that keeps the DB-IP City Lite dataset (~7.9M rows) from exploding into
// millions of individual JS objects at load time.

import { isIP } from "node:net";

import type { ColValue } from "./binary.ts";
import type { AsnColumnsV4, AsnColumnsV6, CityColumnsV4, CityColumnsV6 } from "./parse.ts";
import { ipv4ToUint32, ipv6ToBigInt } from "./parse.ts";

// --- sort permutation + typed-array reordering --------------------------------

function sortPermutationV4(starts: Uint32Array): Uint32Array {
  const perm = new Uint32Array(starts.length);
  for (let i = 0; i < perm.length; i++) perm[i] = i;
  return perm.sort((a, b) => (starts[a] ?? 0) - (starts[b] ?? 0));
}

function sortPermutationV6(starts: bigint[]): Uint32Array {
  const perm = new Uint32Array(starts.length);
  for (let i = 0; i < perm.length; i++) perm[i] = i;
  return perm.sort((a, b) => {
    const sa = starts[a] ?? 0n;
    const sb = starts[b] ?? 0n;
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
}

function permuteU32(src: Uint32Array, perm: Uint32Array): Uint32Array {
  const out = new Uint32Array(perm.length);
  for (let i = 0; i < perm.length; i++) out[i] = src[perm[i] ?? 0] ?? 0;
  return out;
}

function permuteI32(src: Int32Array, perm: Uint32Array): Int32Array {
  const out = new Int32Array(perm.length);
  for (let i = 0; i < perm.length; i++) out[i] = src[perm[i] ?? 0] ?? -1;
  return out;
}

function permuteF32(src: Float32Array, perm: Uint32Array): Float32Array {
  const out = new Float32Array(perm.length);
  for (let i = 0; i < perm.length; i++) out[i] = src[perm[i] ?? 0] ?? Number.NaN;
  return out;
}

function permuteBigInt(src: bigint[], perm: Uint32Array): bigint[] {
  const out: bigint[] = new Array(perm.length);
  for (let i = 0; i < perm.length; i++) out[i] = src[perm[i] ?? 0] ?? 0n;
  return out;
}

// --- binary search over sorted start/end columns, returns a row index (-1 = miss) ---

function lookupIndexV4(starts: Uint32Array, ends: Uint32Array, ip: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if ((starts[mid] ?? 0) <= ip) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0 || ip > (ends[ans] ?? 0)) return -1;
  return ans;
}

function lookupIndexV6(starts: bigint[], ends: bigint[], ip: bigint): number {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if ((starts[mid] ?? 0n) <= ip) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (ans < 0 || ip > (ends[ans] ?? 0n)) return -1;
  return ans;
}

// Exposed for tests only — production code goes through GeoDb.lookup.
export const _internal = { lookupIndexV4, lookupIndexV6 };

// --- table shapes ---------------------------------------------------------------

export interface AsnTableV4 {
  starts: Uint32Array;
  ends: Uint32Array;
  asn: Uint32Array;
  countryIdx: Int32Array;
  orgIdx: Int32Array;
  countryPool: string[];
  orgPool: string[];
}

export interface AsnTableV6 {
  starts: bigint[];
  ends: bigint[];
  asn: Uint32Array;
  countryIdx: Int32Array;
  orgIdx: Int32Array;
  countryPool: string[];
  orgPool: string[];
}

export interface CityTableV4 {
  starts: Uint32Array;
  ends: Uint32Array;
  countryIdx: Int32Array;
  regionIdx: Int32Array;
  cityIdx: Int32Array;
  lat: Float32Array;
  lon: Float32Array;
  countryPool: string[];
  regionPool: string[];
  cityPool: string[];
}

export interface CityTableV6 {
  starts: bigint[];
  ends: bigint[];
  countryIdx: Int32Array;
  regionIdx: Int32Array;
  cityIdx: Int32Array;
  lat: Float32Array;
  lon: Float32Array;
  countryPool: string[];
  regionPool: string[];
  cityPool: string[];
}

export const EMPTY_ASN_V4: AsnTableV4 = {
  starts: new Uint32Array(0),
  ends: new Uint32Array(0),
  asn: new Uint32Array(0),
  countryIdx: new Int32Array(0),
  orgIdx: new Int32Array(0),
  countryPool: [],
  orgPool: [],
};

export const EMPTY_ASN_V6: AsnTableV6 = {
  starts: [],
  ends: [],
  asn: new Uint32Array(0),
  countryIdx: new Int32Array(0),
  orgIdx: new Int32Array(0),
  countryPool: [],
  orgPool: [],
};

export const EMPTY_CITY_V6: CityTableV6 = {
  starts: [],
  ends: [],
  countryIdx: new Int32Array(0),
  regionIdx: new Int32Array(0),
  cityIdx: new Int32Array(0),
  lat: new Float32Array(0),
  lon: new Float32Array(0),
  countryPool: [],
  regionPool: [],
  cityPool: [],
};

export function buildAsnV4(cols: AsnColumnsV4): AsnTableV4 {
  const perm = sortPermutationV4(cols.starts);
  return {
    starts: permuteU32(cols.starts, perm),
    ends: permuteU32(cols.ends, perm),
    asn: permuteU32(cols.asn, perm),
    countryIdx: permuteI32(cols.countryIdx, perm),
    orgIdx: permuteI32(cols.orgIdx, perm),
    countryPool: cols.countryPool,
    orgPool: cols.orgPool,
  };
}

export function buildAsnV6(cols: AsnColumnsV6): AsnTableV6 {
  const perm = sortPermutationV6(cols.starts);
  return {
    starts: permuteBigInt(cols.starts, perm),
    ends: permuteBigInt(cols.ends, perm),
    asn: permuteU32(cols.asn, perm),
    countryIdx: permuteI32(cols.countryIdx, perm),
    orgIdx: permuteI32(cols.orgIdx, perm),
    countryPool: cols.countryPool,
    orgPool: cols.orgPool,
  };
}

export function buildCityV4(cols: CityColumnsV4): CityTableV4 {
  const perm = sortPermutationV4(cols.starts);
  return {
    starts: permuteU32(cols.starts, perm),
    ends: permuteU32(cols.ends, perm),
    countryIdx: permuteI32(cols.countryIdx, perm),
    regionIdx: permuteI32(cols.regionIdx, perm),
    cityIdx: permuteI32(cols.cityIdx, perm),
    lat: permuteF32(cols.lat, perm),
    lon: permuteF32(cols.lon, perm),
    countryPool: cols.countryPool,
    regionPool: cols.regionPool,
    cityPool: cols.cityPool,
  };
}

export function buildCityV6(cols: CityColumnsV6): CityTableV6 {
  const perm = sortPermutationV6(cols.starts);
  return {
    starts: permuteBigInt(cols.starts, perm),
    ends: permuteBigInt(cols.ends, perm),
    countryIdx: permuteI32(cols.countryIdx, perm),
    regionIdx: permuteI32(cols.regionIdx, perm),
    cityIdx: permuteI32(cols.cityIdx, perm),
    lat: permuteF32(cols.lat, perm),
    lon: permuteF32(cols.lon, perm),
    countryPool: cols.countryPool,
    regionPool: cols.regionPool,
    cityPool: cols.cityPool,
  };
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
    private readonly asnV4: AsnTableV4,
    private readonly asnV6: AsnTableV6,
    private readonly cityV4: CityTableV4,
    private readonly cityV6: CityTableV6,
  ) {}

  lookup(ip: string): LocalGeo | null {
    const version = isIP(ip);
    if (version === 0) return null;

    let asnIdx = -1;
    let cityIdx = -1;
    try {
      if (version === 4) {
        const n = ipv4ToUint32(ip);
        asnIdx = lookupIndexV4(this.asnV4.starts, this.asnV4.ends, n);
        cityIdx = lookupIndexV4(this.cityV4.starts, this.cityV4.ends, n);
      } else {
        const n = ipv6ToBigInt(ip);
        asnIdx = lookupIndexV6(this.asnV6.starts, this.asnV6.ends, n);
        cityIdx = lookupIndexV6(this.cityV6.starts, this.cityV6.ends, n);
      }
    } catch {
      return null;
    }

    if (asnIdx < 0 && cityIdx < 0) return null;

    const result: LocalGeo = {};

    if (cityIdx >= 0) {
      const t = version === 4 ? this.cityV4 : this.cityV6;
      const countryI = t.countryIdx[cityIdx] ?? -1;
      if (countryI >= 0) {
        const code = t.countryPool[countryI];
        result.countryCode = code;
        result.country = countryName(code);
      }
      const regionI = t.regionIdx[cityIdx] ?? -1;
      if (regionI >= 0) result.region = t.regionPool[regionI];
      const cityI = t.cityIdx[cityIdx] ?? -1;
      if (cityI >= 0) result.city = t.cityPool[cityI];
      const lat = t.lat[cityIdx];
      if (lat !== undefined && !Number.isNaN(lat)) result.lat = lat;
      const lon = t.lon[cityIdx];
      if (lon !== undefined && !Number.isNaN(lon)) result.lon = lon;
    }

    if (asnIdx >= 0) {
      const t = version === 4 ? this.asnV4 : this.asnV6;
      const asnVal = t.asn[asnIdx] ?? 0;
      if (asnVal > 0) result.asn = asnVal;
      const orgI = t.orgIdx[asnIdx] ?? -1;
      if (orgI >= 0) {
        const org = t.orgPool[orgI];
        result.asName = org;
        result.org = org;
      }
      const countryI = t.countryIdx[asnIdx] ?? -1;
      if (countryI >= 0) result.asnCountry = t.countryPool[countryI];
    }

    return result;
  }
}

// --- (de)serialization glue for binary.ts's flat column/pool format ------------
// The single source of truth for column/pool naming, shared by fetch-datasets.ts
// (writes) and load.ts (reads) so the two sides can't drift apart.

export function asnTablesToColumns(
  v4: AsnTableV4,
  v6: AsnTableV6,
): { columns: Record<string, ColValue>; pools: Record<string, string[]> } {
  return {
    columns: {
      "v4.starts": v4.starts,
      "v4.ends": v4.ends,
      "v4.asn": v4.asn,
      "v4.countryIdx": v4.countryIdx,
      "v4.orgIdx": v4.orgIdx,
      "v6.starts": v6.starts,
      "v6.ends": v6.ends,
      "v6.asn": v6.asn,
      "v6.countryIdx": v6.countryIdx,
      "v6.orgIdx": v6.orgIdx,
    },
    pools: {
      v4Country: v4.countryPool,
      v4Org: v4.orgPool,
      v6Country: v6.countryPool,
      v6Org: v6.orgPool,
    },
  };
}

export function columnsToAsnTables(
  columns: Record<string, ColValue>,
  pools: Record<string, string[]>,
): { v4: AsnTableV4; v6: AsnTableV6 } {
  return {
    v4: {
      starts: (columns["v4.starts"] as Uint32Array | undefined) ?? new Uint32Array(0),
      ends: (columns["v4.ends"] as Uint32Array | undefined) ?? new Uint32Array(0),
      asn: (columns["v4.asn"] as Uint32Array | undefined) ?? new Uint32Array(0),
      countryIdx: (columns["v4.countryIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      orgIdx: (columns["v4.orgIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      countryPool: pools.v4Country ?? [],
      orgPool: pools.v4Org ?? [],
    },
    v6: {
      starts: (columns["v6.starts"] as bigint[] | undefined) ?? [],
      ends: (columns["v6.ends"] as bigint[] | undefined) ?? [],
      asn: (columns["v6.asn"] as Uint32Array | undefined) ?? new Uint32Array(0),
      countryIdx: (columns["v6.countryIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      orgIdx: (columns["v6.orgIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      countryPool: pools.v6Country ?? [],
      orgPool: pools.v6Org ?? [],
    },
  };
}

export function cityTablesToColumns(
  v4: CityTableV4,
  v6: CityTableV6,
): { columns: Record<string, ColValue>; pools: Record<string, string[]> } {
  return {
    columns: {
      "v4.starts": v4.starts,
      "v4.ends": v4.ends,
      "v4.countryIdx": v4.countryIdx,
      "v4.regionIdx": v4.regionIdx,
      "v4.cityIdx": v4.cityIdx,
      "v4.lat": v4.lat,
      "v4.lon": v4.lon,
      "v6.starts": v6.starts,
      "v6.ends": v6.ends,
      "v6.countryIdx": v6.countryIdx,
      "v6.regionIdx": v6.regionIdx,
      "v6.cityIdx": v6.cityIdx,
      "v6.lat": v6.lat,
      "v6.lon": v6.lon,
    },
    // Shared across v4/v6 — both drew from the same interners in parseDbIpCityCsv.
    pools: {
      country: v4.countryPool,
      region: v4.regionPool,
      city: v4.cityPool,
    },
  };
}

export function columnsToCityTables(
  columns: Record<string, ColValue>,
  pools: Record<string, string[]>,
): { v4: CityTableV4; v6: CityTableV6 } {
  const countryPool = pools.country ?? [];
  const regionPool = pools.region ?? [];
  const cityPool = pools.city ?? [];
  return {
    v4: {
      starts: (columns["v4.starts"] as Uint32Array | undefined) ?? new Uint32Array(0),
      ends: (columns["v4.ends"] as Uint32Array | undefined) ?? new Uint32Array(0),
      countryIdx: (columns["v4.countryIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      regionIdx: (columns["v4.regionIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      cityIdx: (columns["v4.cityIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      lat: (columns["v4.lat"] as Float32Array | undefined) ?? new Float32Array(0),
      lon: (columns["v4.lon"] as Float32Array | undefined) ?? new Float32Array(0),
      countryPool,
      regionPool,
      cityPool,
    },
    v6: {
      starts: (columns["v6.starts"] as bigint[] | undefined) ?? [],
      ends: (columns["v6.ends"] as bigint[] | undefined) ?? [],
      countryIdx: (columns["v6.countryIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      regionIdx: (columns["v6.regionIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      cityIdx: (columns["v6.cityIdx"] as Int32Array | undefined) ?? new Int32Array(0),
      lat: (columns["v6.lat"] as Float32Array | undefined) ?? new Float32Array(0),
      lon: (columns["v6.lon"] as Float32Array | undefined) ?? new Float32Array(0),
      countryPool,
      regionPool,
      cityPool,
    },
  };
}
