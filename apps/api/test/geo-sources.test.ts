import { expect, test } from "bun:test";

import { crossCheckGeo } from "../src/lib/geo-sources.ts";

test("crossCheckGeo agrees when both local datasets report the same country", () => {
  const geo = crossCheckGeo({
    countryCode: "NO",
    country: "Norway",
    city: "Oslo",
    asn: 2119,
    asnCountry: "NO",
  });

  expect(geo?.total).toBe(2);
  expect(geo?.agree).toBe(2);
  expect(geo?.countryCode).toBe("NO");
  expect(geo?.sources.map((s) => s.name)).toEqual(["DB-IP", "iptoasn"]);
});

test("crossCheckGeo flags disagreement between DB-IP and iptoasn", () => {
  const geo = crossCheckGeo({ countryCode: "NO", asn: 3301, asnCountry: "SE" });

  expect(geo?.total).toBe(2);
  // Only DB-IP matches the agreed (DB-IP-preferred) code.
  expect(geo?.agree).toBe(1);
  expect(geo?.countryCode).toBe("NO");
});

test("crossCheckGeo reports a single source when only one dataset has a country", () => {
  const geo = crossCheckGeo({ asn: 2119, asnCountry: "NO" });
  expect(geo?.total).toBe(1);
  expect(geo?.agree).toBe(1);
  expect(geo?.sources[0]?.name).toBe("iptoasn");
});

test("crossCheckGeo returns undefined without any country or geo", () => {
  expect(crossCheckGeo({ asn: 2119 })).toBeUndefined();
  expect(crossCheckGeo(null)).toBeUndefined();
});
