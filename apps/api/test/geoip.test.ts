import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeTable } from "../src/geoip/binary.ts";
import { getGeoDb, loadGeoDb } from "../src/geoip/load.ts";
import {
  ipv4ToUint32,
  ipv6ToBigInt,
  parseCsvLine,
  parseDbIpCityCsv,
  parseIp2AsnV4,
  parseIp2AsnV6,
} from "../src/geoip/parse.ts";
import {
  _internal,
  asnTablesToColumns,
  buildAsnV4,
  buildAsnV6,
  buildCityV4,
  buildCityV6,
  cityTablesToColumns,
  EMPTY_ASN_V6,
  EMPTY_CITY_V6,
  GeoDb,
} from "../src/geoip/store.ts";

const { lookupIndexV4, lookupIndexV6 } = _internal;

// --- numeric helpers ---------------------------------------------------------

test("ipv4ToUint32 converts dotted quads", () => {
  expect(ipv4ToUint32("0.0.0.0")).toBe(0);
  expect(ipv4ToUint32("255.255.255.255")).toBe(4294967295);
  expect(ipv4ToUint32("1.2.3.4")).toBe(0x01020304);
  expect(ipv4ToUint32("203.0.113.10")).toBe(3405803786);
});

test("ipv4ToUint32 rejects malformed input", () => {
  expect(() => ipv4ToUint32("1.2.3")).toThrow();
  expect(() => ipv4ToUint32("1.2.3.256")).toThrow();
  expect(() => ipv4ToUint32("a.b.c.d")).toThrow();
});

test("ipv6ToBigInt handles :: expansion and embedded IPv4", () => {
  expect(ipv6ToBigInt("::")).toBe(0n);
  expect(ipv6ToBigInt("::1")).toBe(1n);
  expect(ipv6ToBigInt("2001:db8::1")).toBe(0x20010db8000000000000000000000001n);
  expect(ipv6ToBigInt("2001:db8::")).toBe(0x20010db8000000000000000000000000n);
  // ::ffff:1.2.3.4 → ...ffff:0102:0304
  expect(ipv6ToBigInt("::ffff:1.2.3.4")).toBe(0x00000000000000000000ffff01020304n);
  // full form round-trips
  expect(ipv6ToBigInt("2001:0db8:0000:0000:0000:0000:0000:0001")).toBe(
    0x20010db8000000000000000000000001n,
  );
});

test("ipv6ToBigInt rejects malformed input", () => {
  expect(() => ipv6ToBigInt("2001:db8::1::2")).toThrow();
  expect(() => ipv6ToBigInt("gggg::1")).toThrow();
});

// --- TSV / CSV parsing (columnar + interned) ---------------------------------

test("parseIp2AsnV4 keeps country, drops AS0 asn/org", () => {
  const tsv = [
    "1.0.0.0\t1.0.0.255\t13335\tUS\tCLOUDFLARENET",
    "2.0.0.0\t2.0.0.255\t0\tNone\tNot routed",
    "3.0.0.0\t3.0.0.255\t0\tNO\tReserved but located",
  ].join("\n");
  const cols = parseIp2AsnV4(tsv);
  expect(cols.starts.length).toBe(3);
  expect(cols.starts[0]).toBe(ipv4ToUint32("1.0.0.0"));
  expect(cols.ends[0]).toBe(ipv4ToUint32("1.0.0.255"));
  expect(cols.asn[0]).toBe(13335);
  expect(cols.countryPool[cols.countryIdx[0] ?? -1]).toBe("US");
  expect(cols.orgPool[cols.orgIdx[0] ?? -1]).toBe("CLOUDFLARENET");

  // AS0 + "None" → no asn/org/country retained
  expect(cols.asn[1]).toBe(0);
  expect(cols.orgIdx[1]).toBe(-1);
  expect(cols.countryIdx[1]).toBe(-1);

  // AS0 but a real country → keep the country only
  expect(cols.asn[2]).toBe(0);
  expect(cols.countryPool[cols.countryIdx[2] ?? -1]).toBe("NO");
});

test("parseIp2AsnV4 interns repeated countries/orgs into one pool slot", () => {
  const tsv = [
    "1.0.0.0\t1.0.0.255\t13335\tUS\tCLOUDFLARENET",
    "1.0.1.0\t1.0.1.255\t13335\tUS\tCLOUDFLARENET",
  ].join("\n");
  const cols = parseIp2AsnV4(tsv);
  expect(cols.countryIdx[0]).toBe(cols.countryIdx[1]);
  expect(cols.orgIdx[0]).toBe(cols.orgIdx[1]);
  expect(cols.countryPool).toHaveLength(1);
  expect(cols.orgPool).toHaveLength(1);
});

test("parseIp2AsnV6 parses bigint ranges", () => {
  const cols = parseIp2AsnV6("2001:db8::\t2001:db8::ffff\t64500\tEX\tEXAMPLE");
  expect(cols.starts[0]).toBe(ipv6ToBigInt("2001:db8::"));
  expect(cols.ends[0]).toBe(ipv6ToBigInt("2001:db8::ffff"));
  expect(cols.asn[0]).toBe(64500);
  expect(cols.countryPool[cols.countryIdx[0] ?? -1]).toBe("EX");
});

test("parseCsvLine handles quotes and embedded commas", () => {
  expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  expect(parseCsvLine('"a,1","b",c')).toEqual(["a,1", "b", "c"]);
  expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
});

test("parseDbIpCityCsv splits v4 and v6 rows and interns names", () => {
  const csv = [
    '1.0.0.0,1.0.0.255,AS,"AU",Victoria,Melbourne,-37.8,144.9',
    "2001:db8::,2001:db8::ffff,EU,NO,Oslo,Oslo,59.9,10.7",
  ].join("\n");
  const { v4, v6 } = parseDbIpCityCsv(csv);
  expect(v4.starts).toHaveLength(1);
  expect(v6.starts).toHaveLength(1);

  expect(v4.starts[0]).toBe(ipv4ToUint32("1.0.0.0"));
  expect(v4.ends[0]).toBe(ipv4ToUint32("1.0.0.255"));
  expect(v4.countryPool[v4.countryIdx[0] ?? -1]).toBe("AU");
  expect(v4.regionPool[v4.regionIdx[0] ?? -1]).toBe("Victoria");
  expect(v4.cityPool[v4.cityIdx[0] ?? -1]).toBe("Melbourne");
  expect(v4.lat[0]).toBeCloseTo(-37.8);
  expect(v4.lon[0]).toBeCloseTo(144.9);

  expect(v6.countryPool[v6.countryIdx[0] ?? -1]).toBe("NO");
  expect(v6.cityPool[v6.cityIdx[0] ?? -1]).toBe("Oslo");
});

// --- store: sort + binary search ----------------------------------------------

test("buildCityV4 sorts by start; lookupIndexV4 finds hits, boundaries, misses", () => {
  const csv = [
    "10.0.0.0,10.0.0.9,AS,US,,,0,0",
    "30.0.0.0,30.0.0.9,AS,US,,,0,0",
    "20.0.0.0,20.0.0.9,AS,US,,,0,0",
  ].join("\n");
  const table = buildCityV4(parseDbIpCityCsv(csv).v4);

  // sorted ascending by start despite input order
  expect(Array.from(table.starts)).toEqual([...table.starts].sort((a, b) => a - b));

  const lo = ipv4ToUint32("10.0.0.0");
  const hi = ipv4ToUint32("10.0.0.9");
  expect(lookupIndexV4(table.starts, table.ends, lo)).toBeGreaterThanOrEqual(0); // lower boundary
  expect(lookupIndexV4(table.starts, table.ends, hi)).toBeGreaterThanOrEqual(0); // upper boundary
  expect(lookupIndexV4(table.starts, table.ends, ipv4ToUint32("20.0.0.5"))).toBeGreaterThanOrEqual(
    0,
  ); // interior
  expect(lookupIndexV4(table.starts, table.ends, ipv4ToUint32("9.255.255.255"))).toBe(-1); // below all
  expect(lookupIndexV4(table.starts, table.ends, ipv4ToUint32("40.0.0.0"))).toBe(-1); // above all
  expect(lookupIndexV4(table.starts, table.ends, ipv4ToUint32("15.0.0.0"))).toBe(-1); // gap
});

test("lookupIndexV6 finds hits and misses over bigint ranges", () => {
  const cols = parseIp2AsnV6(
    ["2001:db8:100::\t2001:db8:100::ffff\t1\tUS\tA", "2001:db8::\t2001:db8::ffff\t2\tUS\tB"].join(
      "\n",
    ),
  );
  const table = buildAsnV6(cols);
  expect(
    lookupIndexV6(table.starts, table.ends, ipv6ToBigInt("2001:db8::")),
  ).toBeGreaterThanOrEqual(0);
  expect(
    lookupIndexV6(table.starts, table.ends, ipv6ToBigInt("2001:db8::ffff")),
  ).toBeGreaterThanOrEqual(0);
  expect(lookupIndexV6(table.starts, table.ends, ipv6ToBigInt("2001:db8:200::"))).toBe(-1);
});

test("GeoDb.lookup merges asn + city and separates the two country sources", () => {
  const asnV4 = buildAsnV4(parseIp2AsnV4("1.0.0.0\t1.255.255.255\t13335\tUS\tCLOUDFLARENET"));
  const cityV4 = buildCityV4(
    parseDbIpCityCsv("1.0.0.0,1.0.0.255,OC,AU,Victoria,Melbourne,-37.8,144.9").v4,
  );
  const db = new GeoDb(asnV4, EMPTY_ASN_V6, cityV4, EMPTY_CITY_V6);

  const hit = db.lookup("1.0.0.5");
  expect(hit?.countryCode).toBe("AU"); // DB-IP city country
  expect(hit?.country).toBe("Australia"); // resolved via Intl
  expect(hit?.city).toBe("Melbourne");
  expect(hit?.asn).toBe(13335);
  expect(hit?.asnCountry).toBe("US"); // iptoasn country kept separate
  expect(hit?.org).toBe("CLOUDFLARENET");

  // Covered by ASN but not by any city range → country falls back to asnCountry
  const asnOnly = db.lookup("1.200.0.1");
  expect(asnOnly?.countryCode).toBeUndefined();
  expect(asnOnly?.asnCountry).toBe("US");

  expect(db.lookup("8.8.8.8")).toBeNull(); // outside all ranges
  expect(db.lookup("not-an-ip")).toBeNull();
});

// --- load.ts lifecycle -------------------------------------------------------

test("loadGeoDb returns null when datasets are absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "geoip-empty-"));
  try {
    expect(loadGeoDb(dir)).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadGeoDb reads binary fixtures end-to-end", () => {
  const dir = mkdtempSync(join(tmpdir(), "geoip-fixture-"));
  try {
    const asnV4 = buildAsnV4(parseIp2AsnV4("1.0.0.0\t1.255.255.255\t13335\tUS\tCLOUDFLARENET\n"));
    const asnV6 = buildAsnV6(parseIp2AsnV6("2001:db8::\t2001:db8::ffff\t64500\tEX\tEXAMPLE\n"));
    const asnSer = asnTablesToColumns(asnV4, asnV6);
    writeTable(join(dir, "asn.geobin"), asnSer.columns, asnSer.pools);

    const cityParsed = parseDbIpCityCsv("1.0.0.0,1.0.0.255,OC,AU,Victoria,Melbourne,-37.8,144.9\n");
    const citySer = cityTablesToColumns(buildCityV4(cityParsed.v4), buildCityV6(cityParsed.v6));
    writeTable(join(dir, "city.geobin"), citySer.columns, citySer.pools);

    const db = loadGeoDb(dir);
    expect(db).not.toBeNull();
    const hit = db?.lookup("1.0.0.10");
    expect(hit?.countryCode).toBe("AU");
    expect(hit?.asn).toBe(13335);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadGeoDb loads city data when the ASN table is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "geoip-no-asn-"));
  try {
    const cityParsed = parseDbIpCityCsv("1.0.0.0,1.0.0.255,OC,AU,Victoria,Melbourne,-37.8,144.9\n");
    const citySer = cityTablesToColumns(buildCityV4(cityParsed.v4), buildCityV6(cityParsed.v6));
    writeTable(join(dir, "city.geobin"), citySer.columns, citySer.pools);

    const db = loadGeoDb(dir);
    expect(db).not.toBeNull();
    const hit = db?.lookup("1.0.0.10");
    expect(hit?.countryCode).toBe("AU");
    expect(hit?.asn).toBeUndefined();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("getGeoDb loads once and memoises the result", () => {
  // Datasets aren't committed (gitignored), so in CI this is null; either way the
  // singleton must return a stable reference and never throw.
  expect(getGeoDb()).toBe(getGeoDb());
});
