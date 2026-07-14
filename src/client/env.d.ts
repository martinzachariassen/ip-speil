// Ambient declarations for widely-shipped browser APIs that are missing from
// (or only partially in) the standard DOM lib.
export {};

declare global {
  interface NetworkInformation {
    type?: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }

  interface Navigator {
    deviceMemory?: number;
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
    globalPrivacyControl?: boolean;
  }
}
