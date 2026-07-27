import { expect, test } from "bun:test";

import type { FingerprintData, WebRTCResult } from "../types.ts";
import { estimateEntropy, isForeignPublicIp, webrtcLeak } from "./heuristics.ts";

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
    storage: { localStorage: false, indexedDB: false, cacheAPI: false, serviceWorker: false },
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
