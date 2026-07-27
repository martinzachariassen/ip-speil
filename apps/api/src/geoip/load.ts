// I/O + lifecycle for the local geoip datasets. Reads the prebuilt (gzipped) raw
// dataset files at startup and builds the in-memory search structures. Missing
// files → null (dev/test/CI boot without datasets), never a throw.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { parseDbIpCityCsv, parseIp2AsnV4, parseIp2AsnV6 } from "./parse.ts";
import { type AsnPayload, buildRangesV4, buildRangesV6, type CityPayload, GeoDb } from "./store.ts";

export interface DatasetMeta {
  builtAt?: string;
  sources?: string[];
  dbipMonth?: string;
}

// load.ts lives at apps/api/src/geoip; the datasets are baked into apps/api/data.
export const DEFAULT_DATA_DIR = join(import.meta.dir, "..", "..", "data");

const FILES = {
  asnV4: "ip2asn-v4.tsv.gz",
  asnV6: "ip2asn-v6.tsv.gz",
  city: "dbip-city-lite.csv.gz",
  meta: "dataset-meta.json",
} as const;

let meta: DatasetMeta | undefined;

/** Metadata (build time + attribution) of the currently loaded dataset, if any. */
export function datasetMeta(): DatasetMeta | undefined {
  return meta;
}

function readGz(path: string): string {
  return gunzipSync(readFileSync(path)).toString("utf8");
}

export function loadGeoDb(dataDir: string = DEFAULT_DATA_DIR): GeoDb | null {
  const asnV4Path = join(dataDir, FILES.asnV4);
  const asnV6Path = join(dataDir, FILES.asnV6);
  const cityPath = join(dataDir, FILES.city);

  if (!existsSync(asnV4Path) || !existsSync(asnV6Path) || !existsSync(cityPath)) {
    return null;
  }

  try {
    const asn4 = parseIp2AsnV4(readGz(asnV4Path));
    const asn6 = parseIp2AsnV6(readGz(asnV6Path));
    const city = parseDbIpCityCsv(readGz(cityPath));

    const db = new GeoDb(
      buildRangesV4<AsnPayload>(
        asn4.map((e) => ({
          start: e.start,
          end: e.end,
          payload: { asn: e.asn, country: e.country, org: e.org },
        })),
      ),
      buildRangesV6<AsnPayload>(
        asn6.map((e) => ({
          start: e.start,
          end: e.end,
          payload: { asn: e.asn, country: e.country, org: e.org },
        })),
      ),
      buildRangesV4<CityPayload>(
        city.v4.map((e) => ({
          start: e.start,
          end: e.end,
          payload: { country: e.country, region: e.region, city: e.city, lat: e.lat, lon: e.lon },
        })),
      ),
      buildRangesV6<CityPayload>(
        city.v6.map((e) => ({
          start: e.start,
          end: e.end,
          payload: { country: e.country, region: e.region, city: e.city, lat: e.lat, lon: e.lon },
        })),
      ),
    );

    const metaPath = join(dataDir, FILES.meta);
    if (existsSync(metaPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf8")) as DatasetMeta;
      } catch {
        meta = undefined;
      }
    }

    return db;
  } catch (err) {
    console.error("failed to load geoip datasets:", err);
    return null;
  }
}

let singleton: GeoDb | null | undefined;

/** Lazy-loads the dataset once and memoises the result (including a null miss). */
export function getGeoDb(dataDir: string = DEFAULT_DATA_DIR): GeoDb | null {
  if (singleton === undefined) singleton = loadGeoDb(dataDir);
  return singleton;
}
