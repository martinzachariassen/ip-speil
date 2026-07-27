import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHeaders, fetchInfo } from "../api.ts";
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
import { collectFingerprint } from "../probes/fingerprint.ts";
import { getCFTrace, getDohReachable, getIPv4, getIPv6 } from "../probes/network.ts";
import { getWebRTCIPs } from "../probes/webrtc.ts";
import { buildReport, type Report } from "../report.ts";
import type {
  CFTrace,
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
  webrtc: WebRTCResult;
  ipv6Info: IpInfo | null;
  cfTrace: CFTrace | null;
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

export function useScan(): UseScan {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [fingerprintId, setFingerprintId] = useState("");
  // Bumped on snapshot save/clear so the diff recomputes from localStorage.
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setScan(null);
    setReport(null);

    const [data, webrtc, ipv4, ipv6, cfTrace, headers, doh, dnsLeak, dnssec, fp] =
      await Promise.all([
        fetchInfo(),
        getWebRTCIPs(),
        getIPv4(),
        getIPv6(),
        getCFTrace(),
        fetchHeaders(),
        getDohReachable(),
        getDnsLeak(),
        getDnssec(),
        collectFingerprint(),
      ]);
    const ipv6Info = ipv6 ? await fetchInfo(ipv6) : null;
    const exits: Exits = { http: data.query ?? null, v4: ipv4, v6: ipv6 };
    const entropy = estimateEntropy(fp);
    const fpId = await computeFingerprintId(fp);
    const nextReport = buildReport({
      data,
      webrtc,
      exits,
      ipv6Info,
      cfTrace,
      headers,
      dnsLeak,
      dnssec,
      doh,
      entropy,
    });

    setFingerprintId(fpId);
    setReport(nextReport);
    setScan({ data, webrtc, ipv6Info, cfTrace, headers, doh, dnsLeak, dnssec, fp, entropy, exits });
    setLoading(false);
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
