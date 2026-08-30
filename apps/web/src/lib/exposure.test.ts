import { describe, expect, test } from "bun:test";
import type { ScanError } from "../api.ts";
import type { DnsLeakResult, EntropyEstimate, IpInfo, WebRTCResult } from "../types.ts";
import { bandItems, computeExposure } from "./exposure.ts";

const noWebrtc: WebRTCResult = { pub: [], lan: [], relay: [], mdns: 0, candidates: [] };
const noDnsLeak: DnsLeakResult = { available: false, resolvers: [] };
const entropy: EntropyEstimate = { bits: 12, rarity: "low", contributions: [] };

function exposure(d: IpInfo, error: ScanError | null = null) {
  return computeExposure({ d, webrtc: noWebrtc, dnsLeak: noDnsLeak, doh: null, entropy, error });
}

const BAND_KEYS = ["ip", "location", "anonymity", "webrtc", "fingerprint"];

describe("bandItems", () => {
  test("holds all five columns on a successful lookup", () => {
    const { items } = exposure({
      status: "success",
      query: "1.2.3.4",
      city: "Oslo",
      countryCode: "NO",
    });
    expect(bandItems(items).map((i) => i.key)).toEqual(BAND_KEYS);
  });

  // The whole reason the band fills gaps rather than dropping them: a failed
  // lookup produces no location and no anonymity finding, and three readings
  // stretched over five columns of paper looked broken.
  test("fills the readings a failed lookup can't supply", () => {
    const { items } = exposure({ status: "fail" });
    const band = bandItems(items);
    expect(band.map((i) => i.key)).toEqual(BAND_KEYS);
    const location = band.find((i) => i.key === "location");
    expect(location?.detail).toBe("unknown");
    expect(location?.severity).toBe("off");
    expect(band.every((i) => i.short && i.detail)).toBe(true);
  });

  test("keeps a real finding over the placeholder", () => {
    const { items } = exposure({ status: "success", query: "1.2.3.4", vpn: true });
    expect(bandItems(items).find((i) => i.key === "anonymity")?.detail).toBe("detected");
  });
});

describe("a lookup that produced nothing", () => {
  test("says the connection is being throttled, not that the lookup failed", () => {
    const { verdict, items } = exposure({}, "rate_limited");
    expect(verdict.title).toBe("Scan incomplete.");
    expect(verdict.sub).toContain("throttling");
    expect(items.find((i) => i.key === "ip")?.detail).toBe("rate limited");
  });

  test("distinguishes an erroring service from an unreachable one", () => {
    expect(exposure({}, "unavailable").verdict.sub).toContain("answered with an error");
    expect(exposure({}, "unreachable").verdict.sub).toContain("couldn't be reached");
    expect(exposure({}, "unreachable").items.find((i) => i.key === "ip")?.detail).toBe(
      "unreachable",
    );
  });

  test("keeps the plain wording when the service answered but found nothing", () => {
    const { verdict, items } = exposure({ status: "fail" });
    expect(verdict.sub).toBe("The IP lookup failed — try Refresh.");
    expect(items.find((i) => i.key === "ip")?.detail).toBe("lookup failed");
  });
});
