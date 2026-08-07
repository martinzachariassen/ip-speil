import type { RoutingInfo } from "@ip-speil/shared";

import { getGeoDb } from "../geoip/load.ts";
import type { LocalGeo } from "../geoip/store.ts";
import { crossCheckGeo } from "./geo-sources.ts";
import type { IpInfo } from "./ip-lookup.ts";
import { checkBlocklists, reverseDns } from "./reputation.ts";

export interface EnrichDeps {
  reverseDnsImpl?: (ip: string) => Promise<string | undefined>;
  blocklistImpl?: (ip: string) => Promise<string[]>;
  geoCrossCheck?: boolean;
  geoLookup?: (ip: string) => LocalGeo | null;
  // Routing/RPKI lookup (RIPEstat). Omitted in tests so the suite stays offline.
  routingImpl?: (ip: string) => Promise<RoutingInfo | undefined>;
}

// Composes reverse DNS (local resolver) + DNS-blocklist hits (local resolver) +
// a local two-dataset country cross-check + optional RIPEstat routing context.
// Cached alongside the base result, so this work happens at most once per IP per
// cache window.
export function createEnricher(deps: EnrichDeps): (info: IpInfo) => Promise<IpInfo> {
  const doReverse = deps.reverseDnsImpl ?? ((ip: string) => reverseDns(ip));
  const doBlocklist = deps.blocklistImpl ?? ((ip: string) => checkBlocklists(ip));
  const geoOn = deps.geoCrossCheck ?? true;
  const geoLookup = deps.geoLookup ?? ((ip: string) => getGeoDb()?.lookup(ip) ?? null);
  const doRouting = deps.routingImpl;

  return async (info) => {
    const ip = info.query;
    if (!ip || info.status !== "success") return info;

    const [reverse, blocklists, routing] = await Promise.all([
      doReverse(ip),
      doBlocklist(ip),
      doRouting ? doRouting(ip) : Promise.resolve(undefined),
    ]);
    const geo = geoOn ? crossCheckGeo(geoLookup(ip)) : undefined;

    return {
      ...info,
      reverse: reverse ?? info.reverse,
      blocklists: blocklists.length ? blocklists : undefined,
      geo,
      routing,
    };
  };
}
