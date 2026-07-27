import { expect, test } from "bun:test";

import type { FingerprintData, IpInfo, WebRTCResult } from "../types.ts";
import {
  dnssecVerdict,
  estimateEntropy,
  foreignResolvers,
  isForeignPublicIp,
  ispSuggestsHosting,
  ispSuggestsVpn,
  isVpnSignal,
  languageGeoCheck,
  timezoneCheck,
  webrtcLeak,
} from "./heuristics.ts";

const NO_STORAGE = {
  cookies: false,
  localStorage: false,
  sessionStorage: false,
  indexedDB: false,
  cacheAPI: false,
  serviceWorker: false,
  storageAccessApi: false,
  quotaMb: null,
};

function mkFp(overrides: Partial<FingerprintData> = {}): FingerprintData {
  return {
    canvas: null,
    audio: null,
    webgl: null,
    screen: "1920x1080",
    dpr: 1,
    cpu: null,
    memory: null,
    touch: 0,
    gamut: "sRGB",
    hdr: false,
    platform: "Not exposed",
    fonts: [],
    voices: 0,
    devices: null,
    storage: NO_STORAGE,
    languages: ["en"],
    connection: null,
    ...overrides,
  };
}

const webrtc = (pub: string[]): WebRTCResult => ({
  pub,
  lan: [],
  relay: [],
  mdns: 0,
  candidates: [],
});

test("webrtcLeak only flags a same-family public IP that differs", () => {
  // IPv6 srflx candidate vs an IPv4 HTTP IP is a different address, not a leak.
  expect(webrtcLeak(webrtc(["2001:db8::1"]), "203.0.113.10")).toBe(false);
  expect(webrtcLeak(webrtc(["198.51.100.5"]), "203.0.113.10")).toBe(true);
  expect(webrtcLeak(webrtc(["203.0.113.10"]), "203.0.113.10")).toBe(false);
  expect(webrtcLeak(webrtc([]), "203.0.113.10")).toBe(false);
});

test("isForeignPublicIp compares within IP family only", () => {
  expect(isForeignPublicIp("2001:db8::9", "203.0.113.10")).toBe(false);
  expect(isForeignPublicIp("203.0.113.99", "203.0.113.10")).toBe(true);
  expect(isForeignPublicIp("203.0.113.10", undefined)).toBe(false);
});

test("estimateEntropy rises as more distinguishing signals are present", () => {
  const bare: FingerprintData = {
    canvas: null,
    audio: null,
    webgl: null,
    screen: "1x1 @ 24-bit",
    dpr: 1,
    cpu: null,
    memory: null,
    touch: 0,
    gamut: "sRGB",
    hdr: false,
    platform: "Not exposed",
    fonts: [],
    voices: 0,
    devices: null,
    storage: NO_STORAGE,
    languages: ["en"],
    connection: null,
  };
  const rich: FingerprintData = {
    ...bare,
    canvas: "abc",
    audio: "def",
    webgl: { renderer: "x", vendor: "y" },
    fonts: ["Arial"],
    voices: 12,
  };
  expect(estimateEntropy(rich).bits).toBeGreaterThan(estimateEntropy(bare).bits);
});

test("estimateEntropy: bare browser scores only the always-present screen signal", () => {
  const e = estimateEntropy(mkFp());
  expect(e.bits).toBe(3);
  expect(e.rarity).toBe("low");
  expect(e.contributions).toEqual([{ label: "Screen & pixel ratio", bits: 3 }]);
});

test("estimateEntropy: contributions sum to bits and are sorted most→least", () => {
  const e = estimateEntropy(
    mkFp({
      canvas: "abc",
      audio: "def",
      webgl: { renderer: "R", vendor: "V" },
      fonts: ["Inter"],
      voices: 2,
      languages: ["en-US", "nb-NO"],
      cpu: 8,
      memory: 8,
      touch: 5,
      gamut: "p3",
      hdr: true,
      platform: "Linux x86_64",
    }),
  );
  expect(e.bits).toBe(31);
  expect(e.rarity).toBe("very high");
  expect(e.contributions[0]).toEqual({ label: "Canvas rendering", bits: 6 });
  expect(e.contributions.reduce((s, c) => s + c.bits, 0)).toBe(e.bits);
  const bits = e.contributions.map((c) => c.bits);
  expect([...bits].sort((a, b) => b - a)).toEqual(bits);
});

test("timezoneCheck flags name + offset mismatch using injected env", () => {
  const d: IpInfo = { timezone: "America/New_York", offset: -4 * 3600 };
  const r = timezoneCheck(d, { browserTz: "Europe/Oslo", browserOffsetMin: 120 });
  expect(r.nameMismatch).toBe(true);
  expect(r.offsetMismatch).toBe(true);
  expect(r.browserTz).toBe("Europe/Oslo");
});

test("timezoneCheck: aligned tz + offset → no mismatch", () => {
  const d: IpInfo = { timezone: "Europe/Oslo", offset: 2 * 3600 };
  const r = timezoneCheck(d, { browserTz: "Europe/Oslo", browserOffsetMin: 120 });
  expect(r.nameMismatch).toBe(false);
  expect(r.offsetMismatch).toBe(false);
});

test("languageGeoCheck compares locale region against the IP country", () => {
  expect(languageGeoCheck("US", ["en-US", "en"])).toEqual({ mismatch: false, langRegion: "US" });
  expect(languageGeoCheck("NO", ["en-US"])).toEqual({ mismatch: true, langRegion: "US" });
  expect(languageGeoCheck("US", ["en"])).toEqual({ mismatch: false });
  expect(languageGeoCheck(undefined, ["en-US"])).toEqual({ mismatch: false });
});

test("dnssecVerdict: broken domain blocked → validates; reachable → not; control down → null", () => {
  expect(dnssecVerdict(true, false)).toBe(true);
  expect(dnssecVerdict(true, true)).toBe(false);
  expect(dnssecVerdict(false, false)).toBeNull();
  expect(dnssecVerdict(false, true)).toBeNull();
});

test("foreignResolvers returns resolvers whose country differs", () => {
  const resolvers = [{ country: "US" }, { country: "DE" }, { asn: "AS1" }];
  expect(foreignResolvers(resolvers, "US")).toEqual([{ country: "DE" }]);
  expect(foreignResolvers(resolvers, undefined)).toEqual([]);
});

test("ISP keyword heuristics", () => {
  expect(ispSuggestsVpn({ org: "NordVPN" })).toBe(true);
  expect(ispSuggestsVpn({ org: "Comcast Cable" })).toBe(false);
  expect(ispSuggestsHosting({ asname: "AMAZON-02" })).toBe(true);
  expect(ispSuggestsHosting({ org: "Some Residential ISP" })).toBe(false);
  expect(isVpnSignal({ proxy: true })).toBe(true);
  expect(isVpnSignal({ tor: true })).toBe(true);
  expect(isVpnSignal({ org: "Comcast Cable" })).toBe(false);
});
