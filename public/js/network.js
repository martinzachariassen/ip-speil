// @ts-check
// External network probes: IPv6 reachability and the Cloudflare trace endpoint.

/** Resolve the browser's public IPv6 address, or null if IPv6 is unavailable. */
export async function getIPv6() {
  try {
    const res = await fetch("https://ipv6.icanhazip.com", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const t = (await res.text()).trim();
    return t.includes(":") ? t : null;
  } catch {
    return null;
  }
}

/** Fetch and parse Cloudflare's `cdn-cgi/trace` key=value report, or null. */
export async function getCFTrace() {
  try {
    const res = await fetch("https://1.1.1.1/cdn-cgi/trace", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    /** @type {Record<string, string>} */
    const obj = {};
    (await res.text()).split("\n").forEach((l) => {
      const i = l.indexOf("=");
      if (i > 0) obj[l.slice(0, i)] = l.slice(i + 1);
    });
    return obj;
  } catch {
    return null;
  }
}
