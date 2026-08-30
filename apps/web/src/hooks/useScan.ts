import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchHeaders, fetchInfo, type ScanError } from "../api.ts";
import { diffReports, type SnapshotDiff } from "../lib/diff.ts";
import { estimateEntropy } from "../lib/heuristics.ts";
import {
  clearSnapshot as clearStoredSnapshot,
  computeFingerprintId,
  loadSnapshot,
  saveSnapshot as persistSnapshot,
  type Snapshot,
} from "../lib/snapshot.ts";
import { getDnsLeak } from "../probes/dns-leak.ts";
import { getDnssec } from "../probes/dnssec.ts";
import { collectFingerprint, EMPTY_FINGERPRINT } from "../probes/fingerprint.ts";
import { getDohReachable, getIPv4, getIPv6 } from "../probes/network.ts";
import { getWebRTCIPs } from "../probes/webrtc.ts";
import { buildReport, type Report } from "../report.ts";
import type {
  DnsLeakResult,
  DnssecResult,
  EntropyEstimate,
  Exits,
  FingerprintData,
  HeaderMap,
  IpInfo,
  WebRTCResult,
} from "../types.ts";

// Everything a full render needs, collected once per scan. `null` means a scan is
// in flight and the UI should show skeletons.
export interface Scan {
  data: IpInfo;
  // Why `data` is empty, when it is. null means the lookup itself answered.
  error: ScanError | null;
  webrtc: WebRTCResult;
  ipv6Info: IpInfo | null;
  headers: HeaderMap;
  doh: boolean | null;
  dnsLeak: DnsLeakResult;
  dnssec: DnssecResult;
  fp: FingerprintData;
  entropy: EntropyEstimate;
  exits: Exits;
}

export interface UseScan {
  scan: Scan | null;
  loading: boolean;
  report: Report | null;
  diff: SnapshotDiff | null;
  load: () => void;
  takeSnapshot: () => void;
  clearSnapshot: () => void;
}

// One probe failing must not take the scan with it. Each of these already
// degrades internally; the wrapper is the backstop for the case none of them
// anticipated, and the fallbacks are the same "nothing found" shapes the probes
// return themselves.
const NO_WEBRTC: WebRTCResult = { pub: [], lan: [], relay: [], mdns: 0, candidates: [] };
const NO_DNS_LEAK: DnsLeakResult = { available: false, resolvers: [] };
const NO_DNSSEC: DnssecResult = {
  validates: null,
  controlReachable: false,
  brokenReachable: false,
};

function safe<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  return run().catch(() => fallback);
}

export function useScan(): UseScan {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [fingerprintId, setFingerprintId] = useState("");
  // Bumped on snapshot save/clear so the diff recomputes from localStorage.
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  // Identifies the newest scan, so a superseded one can't publish its result.
  const runRef = useRef(0);

  const load = useCallback(async () => {
    // Refresh is one click away and a scan takes seconds; without this a slow
    // first run could land after a second one and overwrite it.
    const run = ++runRef.current;
    const current = () => run === runRef.current;

    setLoading(true);
    setScan(null);
    setReport(null);

    try {
      const [lookup, webrtc, ipv4, ipv6, headers, doh, dnsLeak, dnssec, fp] = await Promise.all([
        fetchInfo(),
        safe(getWebRTCIPs, NO_WEBRTC),
        safe(getIPv4, null),
        safe(getIPv6, null),
        fetchHeaders(),
        safe(getDohReachable, null),
        safe(getDnsLeak, NO_DNS_LEAK),
        safe(getDnssec, NO_DNSSEC),
        safe(collectFingerprint, EMPTY_FINGERPRINT),
      ]);
      const data = lookup.info;
      const ipv6Info = ipv6 ? (await fetchInfo(ipv6)).info : null;
      const exits: Exits = { http: data.query ?? null, v4: ipv4, v6: ipv6 };
      const entropy = estimateEntropy(fp);
      // crypto.subtle is undefined on an insecure origin, so even the hash needs
      // a fallback: an empty id simply reads as "fingerprint changed".
      const fpId = await safe(() => computeFingerprintId(fp), "");
      const nextReport = buildReport({
        data,
        webrtc,
        exits,
        ipv6Info,
        headers,
        dnsLeak,
        dnssec,
        doh,
        entropy,
      });

      if (!current()) return;
      setFingerprintId(fpId);
      setReport(nextReport);
      setScan({
        data,
        error: lookup.error,
        webrtc,
        ipv6Info,
        headers,
        doh,
        dnsLeak,
        dnssec,
        fp,
        entropy,
        exits,
      });
    } catch (err) {
      // Nothing above is expected to throw — every probe has a fallback. If one
      // finds a way, the page must still stop showing skeletons.
      console.error("scan failed", err);
    } finally {
      if (current()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Show how the current scan differs from the saved snapshot (if any).
  // snapshotVersion is listed intentionally so save/clear re-reads localStorage.
  // biome-ignore lint/correctness/useExhaustiveDependencies: snapshotVersion is an intentional recompute trigger.
  const diff = useMemo<SnapshotDiff | null>(() => {
    const snap = loadSnapshot();
    if (!snap || !report) return null;
    return diffReports(snap.report, report, snap.savedAt, snap.fingerprintId !== fingerprintId);
  }, [report, fingerprintId, snapshotVersion]);

  const takeSnapshot = useCallback(() => {
    if (!report) return;
    const snap: Snapshot = { savedAt: new Date().toISOString(), report, fingerprintId };
    persistSnapshot(snap);
    setSnapshotVersion((v) => v + 1);
  }, [report, fingerprintId]);

  const clearSnapshot = useCallback(() => {
    clearStoredSnapshot();
    setSnapshotVersion((v) => v + 1);
  }, []);

  return { scan, loading, report, diff, load, takeSnapshot, clearSnapshot };
}
