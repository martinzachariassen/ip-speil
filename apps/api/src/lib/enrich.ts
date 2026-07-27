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
}

// Composes reverse DNS (local resolver) + DNS-blocklist hits (local resolver) +
// a local two-dataset country cross-check. Cached alongside the base result, so
// the DNS work happens at most once per IP per cache window.
export function createEnricher(deps: EnrichDeps): (info: IpInfo) => Promise<IpInfo> {
  const doReverse = deps.reverseDnsImpl ?? ((ip: string) => reverseDns(ip));
  const doBlocklist = deps.blocklistImpl ?? ((ip: string) => checkBlocklists(ip));
  const geoOn = deps.geoCrossCheck ?? true;
  const geoLookup = deps.geoLookup ?? ((ip: string) => getGeoDb()?.lookup(ip) ?? null);

  return async (info) => {
    const ip = info.query;
    if (!ip || info.status !== "success") return info;

    const [reverse, blocklists] = await Promise.all([doReverse(ip), doBlocklist(ip)]);
    const geo = geoOn ? crossCheckGeo(geoLookup(ip)) : undefined;

    return {
      ...info,
      reverse: reverse ?? info.reverse,
      blocklists: blocklists.length ? blocklists : undefined,
      geo,
    };
  };
}
