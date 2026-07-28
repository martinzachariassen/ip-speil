import { Icon } from "@martinzachariassen/design";

const PILLS = [
  "No cookies",
  "No database",
  "Cookieless analytics",
  "No ad trackers",
  "Fingerprint stays local",
];

const SOURCES: [string, string][] = [
  ["https://db-ip.com", "IP Geolocation by DB-IP"],
  ["https://iptoasn.com", "iptoasn.com"],
  ["https://www.torproject.org", "Tor exit list"],
  ["https://1.1.1.1/cdn-cgi/trace", "Cloudflare trace"],
  ["https://bash.ws", "bash.ws DNS leak"],
  ["https://icanhazip.com", "icanhazip"],
  ["https://stat.ripe.net", "RIPEstat routing"],
  ["https://dnssec.works", "DNSSEC test"],
];

function H4({ children }: { children: string }) {
  return (
    <h4 className="mb-2.5 font-mono text-[10.5px] font-medium tracking-[0.13em] text-ink-faint uppercase">
      {children}
    </h4>
  );
}

export function FinePrint() {
  return (
    <div className="mt-[34px] border-t border-line pt-[22px]">
      <div className="mb-[22px] flex flex-wrap gap-[7px]">
        {PILLS.map((p) => (
          <span
            key={p}
            className="whitespace-nowrap rounded-full border border-line-2 px-2.5 py-1 font-mono text-[10.5px] tracking-[0.01em] text-ink-soft max-[560px]:px-[9px] max-[560px]:py-[3px] max-[560px]:text-[10px]"
          >
            {p}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-[34px] max-[560px]:grid-cols-1 max-[560px]:gap-[22px]">
        <div>
          <H4>How this works</H4>
          <p className="text-[13.5px] leading-[1.6] text-ink-soft text-pretty">
            On Refresh, the server maps the HTTP IP it sees to geolocation and network (ASN) data
            using local datasets — DB-IP City Lite and iptoasn — so your IP is never sent to a
            third-party geolocation API. It cross-checks the country between those two datasets, adds
            a reverse-DNS and DNS-blocklist check, flags Tor exit nodes from a locally cached list,
            and looks up your network's BGP prefix, origin ASN and RPKI route-origin status via
            RIPEstat — sending only a truncated network block, never your exact address — then caches
            the result in memory. Your browser separately probes its IPv4 and IPv6 exits, runs
            DNS-leak and DNSSEC-validation tests, inspects WebRTC candidates via a public STUN
            server, and estimates a fingerprint. Fingerprint data is computed entirely in your
            browser and never sent back.
          </p>
        </div>
        <div>
          <H4>What we don't do</H4>
          <p className="text-[13.5px] leading-[1.6] text-ink-soft text-pretty">
            This app has no database and the application code does not write request logs. The
            hosting platform may still keep operational logs. It sets no cookies and runs no ad
            trackers. Page visit counts use Umami's cookieless analytics. Every check runs on demand.
          </p>
        </div>
      </div>

      <div className="mt-[26px] flex flex-wrap items-center gap-[14px] font-mono text-[12px] text-ink-faint max-[560px]:gap-x-[14px] max-[560px]:gap-y-2.5">
        <span className="text-[10.5px] tracking-[0.04em] uppercase">Sources</span>
        {SOURCES.map(([href, label]) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 border-b border-line-2 pb-px text-ink-soft transition-colors hover:border-accent hover:text-accent"
          >
            {label}
            <Icon name="external-link" size="xs" className="opacity-60" />
          </a>
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-[30px] flex items-center justify-between gap-3 border-t border-line pt-5 pb-[max(20px,env(safe-area-inset-bottom))] font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase sm:text-[11px]">
      <span>© 2026 · Martin Zachariassen</span>
      <span>59°N · 10°E</span>
    </footer>
  );
}
