import type { GeoCrossCheck, GeoSource } from "@ip-speil/shared";

import { countryName, type LocalGeo } from "../geoip/store.ts";

// The cross-check is now "two independent LOCAL datasets agree on country":
// DB-IP City Lite (the `countryCode`) vs iptoasn (the `asnCountry`). No network.
export function crossCheckGeo(geo: LocalGeo | null): GeoCrossCheck | undefined {
  if (!geo) return undefined;

  const sources: GeoSource[] = [];
  if (geo.countryCode) {
    sources.push({
      name: "DB-IP",
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
    });
  }
  if (geo.asnCountry) {
    sources.push({
      name: "iptoasn",
      country: countryName(geo.asnCountry),
      countryCode: geo.asnCountry,
      asn: geo.asn != null ? `AS${geo.asn}` : undefined,
    });
  }

  if (sources.length === 0) return undefined;

  const agreed = geo.countryCode ?? geo.asnCountry;
  const agreedUpper = agreed?.toUpperCase();
  const agree = agreedUpper
    ? sources.filter((s) => s.countryCode?.toUpperCase() === agreedUpper).length
    : 0;

  return { agree, total: sources.length, countryCode: agreed, sources };
}
