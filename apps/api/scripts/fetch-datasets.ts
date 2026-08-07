#!/usr/bin/env bun
// Build-time dataset fetcher. Downloads the local geoip datasets, parses them,
// and bakes them into apps/api/data/ as compact pre-sorted binary tables so
// /api/info can resolve geo/ASN without ever sending the visitor IP to a third
// party at request time. Run in the Docker build (see apps/api/Dockerfile) —
// not in the app runtime.
//
// Parsing happens here rather than at container startup on purpose: splitting
// DB-IP's ~7.9M-row CSV and rebuilding fields character-by-character allocates
// and discards tens of millions of short-lived strings, and general-purpose
// allocators don't hand those pages back to the OS even after GC reclaims them
// — a container that parsed the raw CSV at boot stayed inflated to several GB
// of resident memory for its entire lifetime and blew past Railway's
// healthcheck window before it ever finished. Doing that work once at build
// time and shipping the already-sorted, already-interned result (geoip/binary.ts)
// means the runtime container just reads typed-array views over a file — no
// per-row allocation, no multi-second parse.
//
// Datasets:
//   - iptoasn.com  ip2asn-v4.tsv.gz / ip2asn-v6.tsv.gz  ->  asn.geobin
//   - DB-IP City Lite (monthly)  dbip-city-lite-YYYY-MM.csv.gz  ->  city.geobin
//
// Attribution required by DB-IP: "IP Geolocation by DB-IP (https://db-ip.com)".

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { writeTable } from "../src/geoip/binary.ts";
import { parseDbIpCityCsv, parseIp2AsnV4, parseIp2AsnV6 } from "../src/geoip/parse.ts";
import {
  asnTablesToColumns,
  buildAsnV4,
  buildAsnV6,
  buildCityV4,
  buildCityV6,
  cityTablesToColumns,
  EMPTY_ASN_V4,
  EMPTY_ASN_V6,
} from "../src/geoip/store.ts";

const DATA_DIR = join(import.meta.dir, "..", "data");
const DOWNLOAD_TIMEOUT_MS = 180_000;

const IPTOASN_V4_URL = "https://iptoasn.com/data/ip2asn-v4.tsv.gz";
const IPTOASN_V6_URL = "https://iptoasn.com/data/ip2asn-v6.tsv.gz";

async function download(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.arrayBuffer();
}

function gunzipText(buf: ArrayBuffer): string {
  return gunzipSync(Buffer.from(buf)).toString("utf8");
}

function monthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Try the current month; DB-IP publishes on the 1st, so fall back to the
// previous month early in a month (or on a transient 404).
async function downloadDbip(): Promise<{ buf: ArrayBuffer; month: string }> {
  const now = new Date();
  const candidates = [now, new Date(now.getFullYear(), now.getMonth() - 1, 1)];
  for (const d of candidates) {
    const month = monthStr(d);
    const url = `https://download.db-ip.com/free/dbip-city-lite-${month}.csv.gz`;
    try {
      const buf = await download(url);
      return { buf, month };
    } catch (err) {
      console.warn(`db-ip ${month} unavailable: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error("db-ip city lite download failed for current and previous month");
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const sources: string[] = [];

  // iptoasn.com fronts its downloads with a bot-blocking edge that 403s most
  // automated requests (confirmed from CI, Railway, and plain local curl) —
  // non-fatal per file: one flaky upstream shouldn't sink the whole image, and
  // the store already treats empty ASN ranges as "no match" rather than an error.
  let asnV4 = EMPTY_ASN_V4;
  let asnV6 = EMPTY_ASN_V6;
  let asnFetched = false;
  try {
    asnV4 = buildAsnV4(parseIp2AsnV4(gunzipText(await download(IPTOASN_V4_URL))));
    console.log(`parsed ip2asn-v4 (${asnV4.starts.length} rows)`);
    asnFetched = true;
  } catch (err) {
    console.warn(`iptoasn v4 unavailable: ${err instanceof Error ? err.message : err}`);
  }
  try {
    asnV6 = buildAsnV6(parseIp2AsnV6(gunzipText(await download(IPTOASN_V6_URL))));
    console.log(`parsed ip2asn-v6 (${asnV6.starts.length} rows)`);
    asnFetched = true;
  } catch (err) {
    console.warn(`iptoasn v6 unavailable: ${err instanceof Error ? err.message : err}`);
  }
  if (asnFetched) sources.push("IP-to-ASN data by iptoasn.com");

  const asnSer = asnTablesToColumns(asnV4, asnV6);
  writeTable(join(DATA_DIR, "asn.geobin"), asnSer.columns, asnSer.pools);
  console.log(`wrote asn.geobin (v4=${asnV4.starts.length} rows, v6=${asnV6.starts.length} rows)`);

  const { buf: cityBuf, month } = await downloadDbip();
  const cityParsed = parseDbIpCityCsv(gunzipText(cityBuf));
  const cityV4 = buildCityV4(cityParsed.v4);
  const cityV6 = buildCityV6(cityParsed.v6);
  const citySer = cityTablesToColumns(cityV4, cityV6);
  writeTable(join(DATA_DIR, "city.geobin"), citySer.columns, citySer.pools);
  console.log(
    `wrote city.geobin (v4=${cityV4.starts.length} rows, v6=${cityV6.starts.length} rows, ${month})`,
  );
  sources.push("IP Geolocation by DB-IP (https://db-ip.com)");

  const meta = { builtAt: new Date().toISOString(), sources, dbipMonth: month };
  await writeFile(join(DATA_DIR, "dataset-meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  console.log("wrote dataset-meta.json");
}

main().catch((err) => {
  console.error("fetch-datasets failed:", err);
  process.exit(1);
});
