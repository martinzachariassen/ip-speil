import { expect, test } from "bun:test";

import { isPrivateIp, parseIceCandidate } from "./webrtc.ts";

test("isPrivateIp classifies RFC1918 / loopback / link-local IPv4", () => {
  expect(isPrivateIp("10.0.0.1")).toBe(true);
  expect(isPrivateIp("192.168.1.1")).toBe(true);
  expect(isPrivateIp("172.16.5.4")).toBe(true);
  expect(isPrivateIp("172.32.5.4")).toBe(false); // just outside 172.16/12
  expect(isPrivateIp("127.0.0.1")).toBe(true);
  expect(isPrivateIp("169.254.1.1")).toBe(true);
  expect(isPrivateIp("8.8.8.8")).toBe(false);
  expect(isPrivateIp("203.0.113.10")).toBe(false);
});

test("isPrivateIp classifies IPv6 loopback / ULA / link-local", () => {
  expect(isPrivateIp("::1")).toBe(true);
  expect(isPrivateIp("fe80::1")).toBe(true);
  expect(isPrivateIp("fc00::1")).toBe(true);
  expect(isPrivateIp("fd12:3456::1")).toBe(true);
  expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
});

test("parseIceCandidate extracts the address and candidate type", () => {
  const srflx =
    "candidate:842163049 1 udp 1677729535 203.0.113.5 51000 typ srflx raddr 0.0.0.0 rport 0 generation 0";
  expect(parseIceCandidate(srflx)).toEqual({ address: "203.0.113.5", type: "srflx" });

  const host = "candidate:1 1 udp 2122260223 192.168.1.5 54321 typ host generation 0";
  expect(parseIceCandidate(host)).toEqual({ address: "192.168.1.5", type: "host" });
});

test("parseIceCandidate returns null on malformed input", () => {
  expect(parseIceCandidate("garbage")).toBeNull();
  expect(parseIceCandidate("candidate:1 1 udp 2122260223 192.168.1.5 54321")).toBeNull();
});
