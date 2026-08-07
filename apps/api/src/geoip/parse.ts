// Pure parsers for the local geoip datasets — no I/O, no globals. They turn the
// raw iptoasn TSV and DB-IP City Lite CSV into numeric ranges the store can index.

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

export interface AsnEntry<N> {
  start: N;
  end: N;
  asn?: number;
  country?: string;
  org?: string;
}

// iptoasn TSV columns: range_start, range_end, AS_number, country_code, AS_description.
// AS_number 0 / country "None" carry no useful asn/org, but we still keep the row
// (and its country when present) so the range stays covered.
function asnFields(cols: string[]): { asn?: number; country?: string; org?: string } {
  const asnNum = Number.parseInt(cols[2] ?? "", 10);
  const country = cols[3] ?? "";
  const descr = cols.slice(4).join("\t").trim();
  const hasAsn = Number.isInteger(asnNum) && asnNum > 0;
  return {
    asn: hasAsn ? asnNum : undefined,
    country: country && country !== "None" ? country : undefined,
    org: hasAsn && descr && descr !== "None" ? descr : undefined,
  };
}

export function parseIp2AsnV4(tsv: string): AsnEntry<number>[] {
  const out: AsnEntry<number>[] = [];
  for (const line of tsv.split(/\r?\n/)) {
    if (!line) continue;
    const cols = line.split("\t");
    if (cols.length < 5) continue;
    try {
      const start = ipv4ToUint32((cols[0] ?? "").trim());
      const end = ipv4ToUint32((cols[1] ?? "").trim());
      out.push({ start, end, ...asnFields(cols) });
    } catch {
      // skip malformed rows
    }
  }
  return out;
}

export function parseIp2AsnV6(tsv: string): AsnEntry<bigint>[] {
  const out: AsnEntry<bigint>[] = [];
  for (const line of tsv.split(/\r?\n/)) {
    if (!line) continue;
    const cols = line.split("\t");
    if (cols.length < 5) continue;
    try {
      const start = ipv6ToBigInt((cols[0] ?? "").trim());
      const end = ipv6ToBigInt((cols[1] ?? "").trim());
      out.push({ start, end, ...asnFields(cols) });
    } catch {
      // skip malformed rows
    }
  }
  return out;
}

export interface CityEntry<N> {
  start: N;
  end: N;
  // `country` holds the 2-letter country code (DB-IP City Lite has no full name).
  country?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

// Splits one CSV line, honouring double-quoted fields and escaped ("") quotes.
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? "";
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function toNum(value: string | undefined): number | undefined {
  const t = (value ?? "").trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// DB-IP City Lite CSV columns (no header): ip_start, ip_end, continent,
// country_code, state/region, city, latitude, longitude. v4 and v6 rows are
// interleaved; we split them by the ':' in the address so each gets a typed store.
export function parseDbIpCityCsv(csv: string): {
  v4: CityEntry<number>[];
  v6: CityEntry<bigint>[];
} {
  const v4: CityEntry<number>[] = [];
  const v6: CityEntry<bigint>[] = [];
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 8) continue;
    const startRaw = (cols[0] ?? "").trim();
    const endRaw = (cols[1] ?? "").trim();
    if (!startRaw || !endRaw) continue;
    const country = (cols[3] ?? "").trim() || undefined;
    const region = (cols[4] ?? "").trim() || undefined;
    const city = (cols[5] ?? "").trim() || undefined;
    const lat = toNum(cols[6]);
    const lon = toNum(cols[7]);
    try {
      if (startRaw.includes(":")) {
        v6.push({
          start: ipv6ToBigInt(startRaw),
          end: ipv6ToBigInt(endRaw),
          country,
          region,
          city,
          lat,
          lon,
        });
      } else {
        v4.push({
          start: ipv4ToUint32(startRaw),
          end: ipv4ToUint32(endRaw),
          country,
          region,
          city,
          lat,
          lon,
        });
      }
    } catch {
      // skip malformed rows
    }
  }
  return { v4, v6 };
}
