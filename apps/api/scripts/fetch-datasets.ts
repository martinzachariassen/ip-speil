#!/usr/bin/env bun
// Build-time dataset fetcher. Downloads the local geoip datasets into
// apps/api/data/ so /api/info can resolve geo/ASN without ever sending the
// visitor IP to a third party at request time. Run in the Docker build (see
// apps/api/Dockerfile) — not in the app runtime.
//
// Datasets:
//   - iptoasn.com  ip2asn-v4.tsv.gz / ip2asn-v6.tsv.gz
//   - DB-IP City Lite (monthly)  dbip-city-lite-YYYY-MM.csv.gz
//
// Attribution required by DB-IP: "IP Geolocation by DB-IP (https://db-ip.com)".

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dir, "..", "data");
const DOWNLOAD_TIMEOUT_MS = 180_000;

const IPTOASN = [
  { url: "https://iptoasn.com/data/ip2asn-v4.tsv.gz", file: "ip2asn-v4.tsv.gz" },
  { url: "https://iptoasn.com/data/ip2asn-v6.tsv.gz", file: "ip2asn-v6.tsv.gz" },
];

async function download(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.arrayBuffer();
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

  for (const { url, file } of IPTOASN) {
    const buf = await download(url);
    await writeFile(join(DATA_DIR, file), Buffer.from(buf));
    console.log(`saved ${file} (${buf.byteLength} bytes)`);
  }
  sources.push("IP-to-ASN data by iptoasn.com");

  const { buf, month } = await downloadDbip();
  await writeFile(join(DATA_DIR, "dbip-city-lite.csv.gz"), Buffer.from(buf));
  console.log(`saved dbip-city-lite.csv.gz (${month}, ${buf.byteLength} bytes)`);
  sources.push("IP Geolocation by DB-IP (https://db-ip.com)");

  const meta = { builtAt: new Date().toISOString(), sources, dbipMonth: month };
  await writeFile(join(DATA_DIR, "dataset-meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  console.log("wrote dataset-meta.json");
}

main().catch((err) => {
  console.error("fetch-datasets failed:", err);
  process.exit(1);
});
