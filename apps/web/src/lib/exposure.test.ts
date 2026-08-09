import { describe, expect, test } from "bun:test";
import type { DnsLeakResult, EntropyEstimate, IpInfo, WebRTCResult } from "../types.ts";
import { bandItems, computeExposure } from "./exposure.ts";

const noWebrtc: WebRTCResult = { pub: [], lan: [], relay: [], mdns: 0, candidates: [] };
const noDnsLeak: DnsLeakResult = { available: false, resolvers: [] };
const entropy: EntropyEstimate = { bits: 12, rarity: "low", contributions: [] };

function exposure(d: IpInfo) {
  return computeExposure({ d, webrtc: noWebrtc, dnsLeak: noDnsLeak, doh: null, entropy });
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
