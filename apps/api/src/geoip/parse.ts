// Pure parsers for the local geoip datasets — no I/O, no globals. They turn the
// raw iptoasn TSV and DB-IP City Lite CSV into columnar, string-interned arrays
// the store can sort and index.
//
// Row-per-object parsing was tried first and doesn't scale: DB-IP City Lite is
// ~7.9M rows, and 7.9M small JS objects (each holding its own country/region/city
// string copies) balloon a 674MB CSV into ~6.7GB resident — Railway's healthcheck
// (and most containers' memory limits) can't survive that. Interning the repeated
// strings (only ~250 countries, ~4k regions, ~176k cities across the whole file)
// and storing everything else in typed arrays cuts that by roughly 30x.

/** Convert a dotted IPv4 string to its unsigned 32-bit integer value. */
export function ipv4ToUint32(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) throw new Error(`invalid IPv4: ${ip}`);
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`invalid IPv4 octet in ${ip}`);
    const octet = Number(part);
    if (octet > 255) throw new Error(`invalid IPv4 octet in ${ip}`);
    result = result * 256 + octet;
  }
  return result >>> 0;
}

/** Convert an IPv6 string (with `::` expansion / embedded IPv4) to a bigint. */
export function ipv6ToBigInt(ip: string): bigint {
  let addr = ip;
  const zone = addr.indexOf("%");
  if (zone !== -1) addr = addr.slice(0, zone);

  // Rewrite a trailing embedded IPv4 (e.g. `::ffff:1.2.3.4`) into two hex groups.
  const lastColon = addr.lastIndexOf(":");
  if (lastColon !== -1 && addr.slice(lastColon + 1).includes(".")) {
    const v4 = ipv4ToUint32(addr.slice(lastColon + 1));
    const hi = (v4 >>> 16) & 0xffff;
    const lo = v4 & 0xffff;
    addr = `${addr.slice(0, lastColon + 1)}${hi.toString(16)}:${lo.toString(16)}`;
  }

  let groups: string[];
  const halves = addr.split("::");
  if (halves.length > 2) throw new Error(`invalid IPv6: ${ip}`);
  if (halves.length === 2) {
    const headStr = halves[0] ?? "";
    const tailStr = halves[1] ?? "";
    const head = headStr ? headStr.split(":") : [];
    const tail = tailStr ? tailStr.split(":") : [];
    const missing = 8 - head.length - tail.length;
    if (missing < 0) throw new Error(`invalid IPv6: ${ip}`);
    groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  } else {
    groups = addr.split(":");
  }
  if (groups.length !== 8) throw new Error(`invalid IPv6: ${ip}`);

  let result = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) throw new Error(`invalid IPv6 group in ${ip}`);
    result = (result << 16n) | BigInt(Number.parseInt(group, 16));
  }
  return result;
}

// --- string interning ---------------------------------------------------------
// Dedupes repeated strings (country/region/city/org names) to a single pooled
// copy plus an integer index. -1 means "no value" (mirrors the old `undefined`).

interface Interner {
  index: Map<string, number>;
  pool: string[];
}

function createInterner(): Interner {
  return { index: new Map(), pool: [] };
}

function intern(interner: Interner, value: string | undefined): number {
  if (!value) return -1;
  const existing = interner.index.get(value);
  if (existing !== undefined) return existing;
  const idx = interner.pool.length;
  interner.pool.push(value);
  interner.index.set(value, idx);
  return idx;
}

// --- iptoasn TSV: range_start, range_end, AS_number, country_code, AS_description ---
// AS_number 0 / country "None" carry no useful asn/org, but the row (and its
// country when present) is still kept so the range stays covered.

export interface AsnColumnsV4 {
  starts: Uint32Array;
  ends: Uint32Array;
  asn: Uint32Array; // 0 = none
  countryIdx: Int32Array; // -1 = none, else index into countryPool
  orgIdx: Int32Array; // -1 = none, else index into orgPool
  countryPool: string[];
  orgPool: string[];
}

export interface AsnColumnsV6 {
  starts: bigint[];
  ends: bigint[];
  asn: Uint32Array;
  countryIdx: Int32Array;
  orgIdx: Int32Array;
  countryPool: string[];
  orgPool: string[];
}

function asnFields(cols: string[]): { asn: number; country?: string; org?: string } {
  const asnNum = Number.parseInt(cols[2] ?? "", 10);
  const country = cols[3] ?? "";
  const descr = cols.slice(4).join("\t").trim();
  const hasAsn = Number.isInteger(asnNum) && asnNum > 0;
  return {
    asn: hasAsn ? asnNum : 0,
    country: country && country !== "None" ? country : undefined,
    org: hasAsn && descr && descr !== "None" ? descr : undefined,
  };
}

export function parseIp2AsnV4(tsv: string): AsnColumnsV4 {
  const countryPool = createInterner();
  const orgPool = createInterner();
  const starts: number[] = [];
  const ends: number[] = [];
  const asns: number[] = [];
  const countryIdx: number[] = [];
  const orgIdx: number[] = [];

  forEachLine(tsv, (line) => {
    const cols = line.split("\t");
    if (cols.length < 5) return;
    let start: number;
    let end: number;
    try {
      start = ipv4ToUint32((cols[0] ?? "").trim());
      end = ipv4ToUint32((cols[1] ?? "").trim());
    } catch {
      return; // skip malformed rows
    }
    const fields = asnFields(cols);
    starts.push(start);
    ends.push(end);
    asns.push(fields.asn);
    countryIdx.push(intern(countryPool, fields.country));
    orgIdx.push(intern(orgPool, fields.org));
  });

  return {
    starts: Uint32Array.from(starts),
    ends: Uint32Array.from(ends),
    asn: Uint32Array.from(asns),
    countryIdx: Int32Array.from(countryIdx),
    orgIdx: Int32Array.from(orgIdx),
    countryPool: countryPool.pool,
    orgPool: orgPool.pool,
  };
}

export function parseIp2AsnV6(tsv: string): AsnColumnsV6 {
  const countryPool = createInterner();
  const orgPool = createInterner();
  const starts: bigint[] = [];
  const ends: bigint[] = [];
  const asns: number[] = [];
  const countryIdx: number[] = [];
  const orgIdx: number[] = [];

  forEachLine(tsv, (line) => {
    const cols = line.split("\t");
    if (cols.length < 5) return;
    let start: bigint;
    let end: bigint;
    try {
      start = ipv6ToBigInt((cols[0] ?? "").trim());
      end = ipv6ToBigInt((cols[1] ?? "").trim());
    } catch {
      return;
    }
    const fields = asnFields(cols);
    starts.push(start);
    ends.push(end);
    asns.push(fields.asn);
    countryIdx.push(intern(countryPool, fields.country));
    orgIdx.push(intern(orgPool, fields.org));
  });

  return {
    starts,
    ends,
    asn: Uint32Array.from(asns),
    countryIdx: Int32Array.from(countryIdx),
    orgIdx: Int32Array.from(orgIdx),
    countryPool: countryPool.pool,
    orgPool: orgPool.pool,
  };
}

const QUOTE = 34; // '"'.charCodeAt(0)

// Splits one CSV line, honouring double-quoted fields and escaped ("") quotes.
// DB-IP quotes every multi-word city/region name (not just ones with embedded
// commas), so roughly half of a 7.9M-row file hits the quoted path — building
// each field character-by-character there was the dominant cost of loading the
// dataset (dwarfing the row-storage shape). indexOf()/slice() do the same work
// in native code; only a field with an escaped `""` needs the extra replace.
export function parseCsvLine(line: string): string[] {
  if (line.indexOf('"') === -1) return line.split(",");

  const fields: string[] = [];
  const len = line.length;
  let pos = 0;
  while (pos <= len) {
    if (line.charCodeAt(pos) === QUOTE) {
      let end = pos + 1;
      let hasEscape = false;
      while (end < len) {
        if (line.charCodeAt(end) !== QUOTE) {
          end++;
          continue;
        }
        if (line.charCodeAt(end + 1) === QUOTE) {
          hasEscape = true;
          end += 2;
          continue;
        }
        break;
      }
      const raw = line.slice(pos + 1, end);
      fields.push(hasEscape ? raw.replace(/""/g, '"') : raw);
      pos = end + 2; // skip closing quote + the following comma
    } else {
      let end = line.indexOf(",", pos);
      if (end === -1) end = len;
      fields.push(line.slice(pos, end));
      pos = end + 1;
    }
  }
  return fields;
}

// Iterates lines without materialising a full `text.split(/\r?\n/)` array up
// front — for a multi-million-line file that array alone (every line alive at
// once) was a meaningful chunk of peak memory during parsing.
function forEachLine(text: string, fn: (line: string) => void): void {
  const len = text.length;
  let start = 0;
  while (start < len) {
    const nl = text.indexOf("\n", start);
    const next = nl === -1 ? len : nl + 1;
    let lineEnd = nl === -1 ? len : nl;
    if (lineEnd > start && text.charCodeAt(lineEnd - 1) === 13) lineEnd--; // trailing \r
    if (lineEnd > start) fn(text.slice(start, lineEnd));
    start = next;
  }
}

function toNum(value: string | undefined): number {
  const t = (value ?? "").trim();
  if (!t) return Number.NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

// --- DB-IP City Lite CSV (no header): ip_start, ip_end, continent, country_code,
// state/region, city, latitude, longitude. v4 and v6 rows are interleaved; split
// by the ':' in the address so each gets its own typed store. country/region/city
// interning is shared across v4 and v6 since both draw from the same pools.

export interface CityColumnsV4 {
  starts: Uint32Array;
  ends: Uint32Array;
  countryIdx: Int32Array;
  regionIdx: Int32Array;
  cityIdx: Int32Array;
  lat: Float32Array; // NaN = none
  lon: Float32Array;
  countryPool: string[];
  regionPool: string[];
  cityPool: string[];
}

export interface CityColumnsV6 {
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

export function parseDbIpCityCsv(csv: string): { v4: CityColumnsV4; v6: CityColumnsV6 } {
  const countryPool = createInterner();
  const regionPool = createInterner();
  const cityPool = createInterner();

  const starts4: number[] = [];
  const ends4: number[] = [];
  const countryIdx4: number[] = [];
  const regionIdx4: number[] = [];
  const cityIdx4: number[] = [];
  const lat4: number[] = [];
  const lon4: number[] = [];

  const starts6: bigint[] = [];
  const ends6: bigint[] = [];
  const countryIdx6: number[] = [];
  const regionIdx6: number[] = [];
  const cityIdx6: number[] = [];
  const lat6: number[] = [];
  const lon6: number[] = [];

  forEachLine(csv, (line) => {
    const cols = parseCsvLine(line);
    if (cols.length < 8) return;
    const startRaw = (cols[0] ?? "").trim();
    const endRaw = (cols[1] ?? "").trim();
    if (!startRaw || !endRaw) return;
    const isV6 = startRaw.includes(":");

    if (isV6) {
      let start: bigint;
      let end: bigint;
      try {
        start = ipv6ToBigInt(startRaw);
        end = ipv6ToBigInt(endRaw);
      } catch {
        return;
      }
      starts6.push(start);
      ends6.push(end);
      countryIdx6.push(intern(countryPool, (cols[3] ?? "").trim() || undefined));
      regionIdx6.push(intern(regionPool, (cols[4] ?? "").trim() || undefined));
      cityIdx6.push(intern(cityPool, (cols[5] ?? "").trim() || undefined));
      lat6.push(toNum(cols[6]));
      lon6.push(toNum(cols[7]));
    } else {
      let start: number;
      let end: number;
      try {
        start = ipv4ToUint32(startRaw);
        end = ipv4ToUint32(endRaw);
      } catch {
        return;
      }
      starts4.push(start);
      ends4.push(end);
      countryIdx4.push(intern(countryPool, (cols[3] ?? "").trim() || undefined));
      regionIdx4.push(intern(regionPool, (cols[4] ?? "").trim() || undefined));
      cityIdx4.push(intern(cityPool, (cols[5] ?? "").trim() || undefined));
      lat4.push(toNum(cols[6]));
      lon4.push(toNum(cols[7]));
    }
  });

  return {
    v4: {
      starts: Uint32Array.from(starts4),
      ends: Uint32Array.from(ends4),
      countryIdx: Int32Array.from(countryIdx4),
      regionIdx: Int32Array.from(regionIdx4),
      cityIdx: Int32Array.from(cityIdx4),
      lat: Float32Array.from(lat4),
      lon: Float32Array.from(lon4),
      countryPool: countryPool.pool,
      regionPool: regionPool.pool,
      cityPool: cityPool.pool,
    },
    v6: {
      starts: starts6,
      ends: ends6,
      countryIdx: Int32Array.from(countryIdx6),
      regionIdx: Int32Array.from(regionIdx6),
      cityIdx: Int32Array.from(cityIdx6),
      lat: Float32Array.from(lat6),
      lon: Float32Array.from(lon6),
      countryPool: countryPool.pool,
      regionPool: regionPool.pool,
      cityPool: cityPool.pool,
    },
  };
}
