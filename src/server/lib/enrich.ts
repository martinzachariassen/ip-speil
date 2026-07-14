import type { FetchLike } from "./fetch.ts";
import { crossCheckGeo } from "./geo-sources.ts";
import type { IpInfo } from "./ip-lookup.ts";
import { checkBlocklists, reverseDns } from "./reputation.ts";

export interface EnrichDeps {
  fetchImpl: FetchLike;
  timeoutMs: number;
  reverseDnsImpl?: (ip: string) => Promise<string | undefined>;
  blocklistImpl?: (ip: string) => Promise<string[]>;
  geoCrossCheck?: boolean;
}

// Runs alongside a successful ipapi.is lookup; the result is cached with it, so
// the extra DNS/geo work happens at most once per IP per cache window.
export function createEnricher(deps: EnrichDeps): (info: IpInfo) => Promise<IpInfo> {
  const doReverse = deps.reverseDnsImpl ?? ((ip: string) => reverseDns(ip));
  const doBlocklist = deps.blocklistImpl ?? ((ip: string) => checkBlocklists(ip));
  const geoOn = deps.geoCrossCheck ?? true;

  return async (info) => {
    const ip = info.query;
    if (!ip || info.status !== "success") return info;

    const [reverse, blocklists, geo] = await Promise.all([
      doReverse(ip),
      doBlocklist(ip),
      geoOn ? crossCheckGeo(info, deps) : Promise.resolve(undefined),
    ]);

    return {
      ...info,
      reverse: reverse ?? info.reverse,
      blocklists: blocklists.length ? blocklists : undefined,
      geo,
    };
  };
}
