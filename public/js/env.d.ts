// Ambient declarations for non-standard browser APIs used by the fingerprint
// probes. These are widely shipped but missing from the standard DOM lib.

interface NetworkInformation {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface Navigator {
  /** Approximate device RAM in GB (Chromium). */
  deviceMemory?: number;
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}
