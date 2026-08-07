// I/O + lifecycle for the local geoip datasets. Reads the pre-built binary
// tables (see binary.ts, produced at Docker build time by fetch-datasets.ts) at
// startup — no text parsing happens here, just typed-array views over the
// file's own read buffer. No city file → null (dev/test/CI boot without
// datasets), never a throw. Missing ASN data degrades to empty ranges rather
// than failing the whole load — iptoasn.com blocks automated downloads often
// enough (see fetch-datasets.ts) that a build can ship city data without ASN
// data rather than losing the whole dataset over one flaky upstream.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { log } from "../lib/log.ts";
import { readTable } from "./binary.ts";
import {
  columnsToAsnTables,
  columnsToCityTables,
  EMPTY_ASN_V4,
  EMPTY_ASN_V6,
  GeoDb,
} from "./store.ts";

export interface DatasetMeta {
  builtAt?: string;
  sources?: string[];
  dbipMonth?: string;
}

// load.ts lives at apps/api/src/geoip; the datasets are baked into apps/api/data.
export const DEFAULT_DATA_DIR = join(import.meta.dir, "..", "..", "data");

const FILES = {
  asn: "asn.geobin",
  city: "city.geobin",
  meta: "dataset-meta.json",
} as const;

let meta: DatasetMeta | undefined;

/** Metadata (build time + attribution) of the currently loaded dataset, if any. */
export function datasetMeta(): DatasetMeta | undefined {
  return meta;
}

export function loadGeoDb(dataDir: string = DEFAULT_DATA_DIR): GeoDb | null {
  const asnPath = join(dataDir, FILES.asn);
  const cityPath = join(dataDir, FILES.city);

  if (!existsSync(cityPath)) {
    return null;
  }

  try {
    const city = readTable(cityPath);
    const { v4: cityV4, v6: cityV6 } = columnsToCityTables(city.columns, city.pools);

    let asnV4 = EMPTY_ASN_V4;
    let asnV6 = EMPTY_ASN_V6;
    if (existsSync(asnPath)) {
      const asn = readTable(asnPath);
      ({ v4: asnV4, v6: asnV6 } = columnsToAsnTables(asn.columns, asn.pools));
    }

    const db = new GeoDb(asnV4, asnV6, cityV4, cityV6);

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
    log.error("failed to load geoip datasets", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

let singleton: GeoDb | null | undefined;

/** Lazy-loads the dataset once and memoises the result (including a null miss). */
export function getGeoDb(dataDir: string = DEFAULT_DATA_DIR): GeoDb | null {
  if (singleton === undefined) singleton = loadGeoDb(dataDir);
  return singleton;
}
