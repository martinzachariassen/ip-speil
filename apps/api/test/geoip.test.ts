import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { getGeoDb, loadGeoDb } from "../src/geoip/load.ts";
import {
  ipv4ToUint32,
  ipv6ToBigInt,
  parseCsvLine,
  parseDbIpCityCsv,
  parseIp2AsnV4,
  parseIp2AsnV6,
} from "../src/geoip/parse.ts";
import { buildRangesV4, buildRangesV6, GeoDb, lookupV4, lookupV6 } from "../src/geoip/store.ts";

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

// --- TSV / CSV parsing -------------------------------------------------------

test("parseIp2AsnV4 keeps country, drops AS0 asn/org", () => {
  const tsv = [
    "1.0.0.0\t1.0.0.255\t13335\tUS\tCLOUDFLARENET",
    "2.0.0.0\t2.0.0.255\t0\tNone\tNot routed",
    "3.0.0.0\t3.0.0.255\t0\tNO\tReserved but located",
  ].join("\n");
  const rows = parseIp2AsnV4(tsv);
  expect(rows).toHaveLength(3);
  expect(rows[0]).toEqual({
    start: ipv4ToUint32("1.0.0.0"),
    end: ipv4ToUint32("1.0.0.255"),
    asn: 13335,
    country: "US",
    org: "CLOUDFLARENET",
  });
  // AS0 + "None" → no asn/org/country retained
  expect(rows[1]?.asn).toBeUndefined();
  expect(rows[1]?.org).toBeUndefined();
  expect(rows[1]?.country).toBeUndefined();
  // AS0 but a real country → keep the country only
  expect(rows[2]?.asn).toBeUndefined();
  expect(rows[2]?.country).toBe("NO");
});

test("parseIp2AsnV6 parses bigint ranges", () => {
  const rows = parseIp2AsnV6("2001:db8::\t2001:db8::ffff\t64500\tEX\tEXAMPLE");
  expect(rows[0]?.start).toBe(ipv6ToBigInt("2001:db8::"));
  expect(rows[0]?.end).toBe(ipv6ToBigInt("2001:db8::ffff"));
  expect(rows[0]?.asn).toBe(64500);
});

test("parseCsvLine handles quotes and embedded commas", () => {
  expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  expect(parseCsvLine('"a,1","b",c')).toEqual(["a,1", "b", "c"]);
  expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
});

test("parseDbIpCityCsv splits v4 and v6 rows", () => {
  const csv = [
    '1.0.0.0,1.0.0.255,AS,"AU",Victoria,Melbourne,-37.8,144.9',
    "2001:db8::,2001:db8::ffff,EU,NO,Oslo,Oslo,59.9,10.7",
  ].join("\n");
  const { v4, v6 } = parseDbIpCityCsv(csv);
  expect(v4).toHaveLength(1);
  expect(v6).toHaveLength(1);
  expect(v4[0]).toEqual({
    start: ipv4ToUint32("1.0.0.0"),
    end: ipv4ToUint32("1.0.0.255"),
    country: "AU",
    region: "Victoria",
    city: "Melbourne",
    lat: -37.8,
    lon: 144.9,
  });
  expect(v6[0]?.country).toBe("NO");
  expect(v6[0]?.city).toBe("Oslo");
});

// --- store binary search -----------------------------------------------------

test("lookupV4 finds hits, boundaries, and misses", () => {
  const ranges = buildRangesV4<string>([
    { start: 30, end: 39, payload: "c" },
    { start: 10, end: 19, payload: "a" },
    { start: 20, end: 29, payload: "b" },
  ]);
  expect(lookupV4(ranges, 10)).toBe("a"); // lower boundary
  expect(lookupV4(ranges, 19)).toBe("a"); // upper boundary
  expect(lookupV4(ranges, 25)).toBe("b"); // interior
  expect(lookupV4(ranges, 39)).toBe("c");
  expect(lookupV4(ranges, 9)).toBeNull(); // below all
  expect(lookupV4(ranges, 100)).toBeNull(); // above all
  // in a gap between ranges (no range covers it)
  const gap = buildRangesV4<string>([
    { start: 10, end: 19, payload: "a" },
    { start: 30, end: 39, payload: "c" },
  ]);
  expect(lookupV4(gap, 25)).toBeNull();
});

test("lookupV6 finds hits and misses over bigint ranges", () => {
  const ranges = buildRangesV6<string>([
    { start: 100n, end: 199n, payload: "x" },
    { start: 0n, end: 99n, payload: "y" },
  ]);
  expect(lookupV6(ranges, 0n)).toBe("y");
  expect(lookupV6(ranges, 99n)).toBe("y");
  expect(lookupV6(ranges, 150n)).toBe("x");
  expect(lookupV6(ranges, 200n)).toBeNull();
});

test("GeoDb.lookup merges asn + city and separates the two country sources", () => {
  const db = new GeoDb(
    buildRangesV4([
      {
        start: ipv4ToUint32("1.0.0.0"),
        end: ipv4ToUint32("1.255.255.255"),
        payload: { asn: 13335, country: "US", org: "CLOUDFLARENET" },
      },
    ]),
    buildRangesV6([]),
    buildRangesV4([
      {
        start: ipv4ToUint32("1.0.0.0"),
        end: ipv4ToUint32("1.0.0.255"),
        payload: { country: "AU", region: "Victoria", city: "Melbourne", lat: -37.8, lon: 144.9 },
      },
    ]),
    buildRangesV6([]),
  );

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

test("loadGeoDb reads gzipped fixtures end-to-end", () => {
  const dir = mkdtempSync(join(tmpdir(), "geoip-fixture-"));
  try {
    writeFileSync(
      join(dir, "ip2asn-v4.tsv.gz"),
      gzipSync("1.0.0.0\t1.255.255.255\t13335\tUS\tCLOUDFLARENET\n"),
    );
    writeFileSync(
      join(dir, "ip2asn-v6.tsv.gz"),
      gzipSync("2001:db8::\t2001:db8::ffff\t64500\tEX\tEXAMPLE\n"),
    );
    writeFileSync(
      join(dir, "dbip-city-lite.csv.gz"),
      gzipSync("1.0.0.0,1.0.0.255,OC,AU,Victoria,Melbourne,-37.8,144.9\n"),
    );

    const db = loadGeoDb(dir);
    expect(db).not.toBeNull();
    const hit = db?.lookup("1.0.0.10");
    expect(hit?.countryCode).toBe("AU");
    expect(hit?.asn).toBe(13335);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("getGeoDb loads once and memoises the result", () => {
  // Datasets aren't committed (gitignored), so in CI this is null; either way the
  // singleton must return a stable reference and never throw.
  expect(getGeoDb()).toBe(getGeoDb());
});
