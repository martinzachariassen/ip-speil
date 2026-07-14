import type { IceCandidateInfo, WebRTCResult } from "../types.ts";

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:")
    );
  }

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

export function parseIceCandidate(candidate: string): { address: string; type: string } | null {
  const parts = candidate.trim().split(/\s+/);
  const typIndex = parts.indexOf("typ");
  if (parts.length < 8 || typIndex === -1) return null;
  return { address: parts[4], type: parts[typIndex + 1] || "unknown" };
}

// Resolves after the first null candidate or a 3s timeout.
export async function getWebRTCIPs(): Promise<WebRTCResult> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });
      pc.createDataChannel("");
      const pub = new Set<string>();
      const lan = new Set<string>();
      const relay = new Set<string>();
      const candidates = new Map<string, IceCandidateInfo>();
      let mdns = 0;
      const addCandidate = (type: string, address: string, scope: string) => {
        candidates.set(`${type}|${address}|${scope}`, { type, address, scope });
      };
      const done = (): WebRTCResult => ({
        pub: [...pub],
        lan: [...lan],
        relay: [...relay],
        mdns,
        candidates: [...candidates.values()],
      });

      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          pc.close();
          resolve(done());
          return;
        }
        const parsed = parseIceCandidate(e.candidate.candidate);
        if (!parsed) return;
        if (parsed.address.endsWith(".local")) {
          mdns += 1;
          addCandidate(parsed.type, parsed.address, "mDNS masked");
          return;
        }
        if (parsed.type === "relay") {
          relay.add(parsed.address);
          addCandidate(parsed.type, parsed.address, "relay");
          return;
        }
        const isPrivate = isPrivateIp(parsed.address);
        (isPrivate ? lan : pub).add(parsed.address);
        addCandidate(parsed.type, parsed.address, isPrivate ? "private" : "public");
      };
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .catch(() => resolve(done()));
      setTimeout(() => {
        try {
          pc.close();
        } catch {}
        resolve(done());
      }, 3000);
    } catch {
      resolve({ pub: [], lan: [], relay: [], mdns: 0, candidates: [] });
    }
  });
}
