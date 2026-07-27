import { expect, test } from "bun:test";

import type { HeaderMap } from "../types.ts";
import { anyClientHintAnswered, clientHintsStatus, isClientHintHeader } from "./client-hints.ts";

test("clientHintsStatus reports each requested hint's presence/value", () => {
  const headers: HeaderMap = {
    "user-agent": "Mozilla/5.0",
    "sec-ch-ua-arch": '"x86"',
    "sec-ch-ua-bitness": '"64"',
  };
  const status = clientHintsStatus(headers);
  const arch = status.find((s) => s.header === "sec-ch-ua-arch");
  const model = status.find((s) => s.header === "sec-ch-ua-model");
  expect(arch?.value).toBe('"x86"');
  expect(model?.value).toBeNull();
});

test("clientHintsStatus joins array-valued headers", () => {
  const headers: HeaderMap = {
    "sec-ch-ua-full-version-list": ['"Chromium";v="120"', '"Not?A_Brand"'],
  };
  const fv = clientHintsStatus(headers).find((s) => s.header === "sec-ch-ua-full-version-list");
  expect(fv?.value).toBe('"Chromium";v="120", "Not?A_Brand"');
});

test("anyClientHintAnswered reflects whether the browser opted in", () => {
  expect(anyClientHintAnswered({ "sec-ch-ua-arch": '"x86"' })).toBe(true);
  expect(anyClientHintAnswered({ "user-agent": "Firefox" })).toBe(false);
  expect(anyClientHintAnswered({})).toBe(false);
});

test("isClientHintHeader only matches solicited high-entropy hints", () => {
  expect(isClientHintHeader("sec-ch-ua-arch")).toBe(true);
  expect(isClientHintHeader("sec-ch-ua-platform-version")).toBe(true);
  // Low-entropy hints are sent unprompted, so they are NOT in the solicited set.
  expect(isClientHintHeader("sec-ch-ua")).toBe(false);
  expect(isClientHintHeader("user-agent")).toBe(false);
});
