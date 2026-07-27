import { isIP } from "node:net";

// Order: first x-forwarded-for entry, then x-real-ip, then the socket address.
// Unroutable socket addresses (loopback, RFC 1918, link-local, ULA) collapse to
// "" so the caller can let the geo lookup fall back to the request source IP —
// that way localhost:3000 still resolves the dev machine's WAN IP.
export function getClientIp(headers: Headers, socketRemoteAddress?: string): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const socket = normaliseSocketAddress(socketRemoteAddress);
  return isUnroutableIp(socket) ? "" : socket;
}

export const isProbablyIp = (value: string): boolean => isIP(value) !== 0;

function normaliseSocketAddress(address: string | undefined): string {
  if (!address) return "";
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function isUnroutableIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip === "::") return true;
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true;
  return false;
}
