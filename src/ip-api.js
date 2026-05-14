const IP_API_FIELDS = [
  "status", "message", "country", "countryCode", "region", "regionName",
  "city", "zip", "lat", "lon", "timezone", "offset", "isp", "org",
  "as", "asname", "reverse", "mobile", "proxy", "hosting", "query",
].join(",");

export function getClientIp(headers) {
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? "";
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(",")[0]?.trim() ?? "";
  }

  return typeof realIp === "string" ? realIp.trim() : "";
}

export async function getIpInfo(ip, {
  fetchImpl = fetch,
  ipApiBaseUrl = "http://ip-api.com",
  timeoutMs,
} = {}) {
  const baseUrl = ip
    ? `${ipApiBaseUrl}/json/${encodeURIComponent(ip)}`
    : `${ipApiBaseUrl}/json/`;
  const res = await fetchImpl(`${baseUrl}?fields=${IP_API_FIELDS}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`ip-api responded with ${res.status}`);
  }

  const data = await res.json();
  if (data?.status === "fail") {
    throw new Error(data.message || "ip-api lookup failed");
  }

  return data;
}
