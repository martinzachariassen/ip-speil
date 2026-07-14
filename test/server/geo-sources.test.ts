import { expect, test } from "bun:test";

import type { FetchLike } from "../../src/server/lib/fetch.ts";
import { crossCheckGeo } from "../../src/server/lib/geo-sources.ts";

test("crossCheckGeo counts country agreement across all sources", async () => {
  const fetchImpl: FetchLike = async (url) => {
    const u = String(url);
    if (u.includes("ipwho.is")) return Response.json({ success: true, country_code: "NO" });
    if (u.includes("geojs.io")) return Response.json({ country_code: "SE" });
    return Response.json({});
  };

  const geo = await crossCheckGeo(
    { status: "success", query: "203.0.113.10", countryCode: "NO" },
    { fetchImpl, timeoutMs: 100 },
  );

  expect(geo?.total).toBe(3);
  // ipapi.is (NO) + ipwho.is (NO) agree; geojs.io (SE) differs.
  expect(geo?.agree).toBe(2);
});

test("crossCheckGeo drops providers that error and still reports the primary", async () => {
  const fetchImpl: FetchLike = async () => {
    throw new Error("network down");
  };

  const geo = await crossCheckGeo(
    { status: "success", query: "203.0.113.10", countryCode: "NO" },
    { fetchImpl, timeoutMs: 100 },
  );

  expect(geo?.total).toBe(1);
  expect(geo?.agree).toBe(1);
  expect(geo?.sources[0]?.name).toBe("ipapi.is");
});
