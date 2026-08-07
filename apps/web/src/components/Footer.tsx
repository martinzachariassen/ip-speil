export function Footer() {
  return (
    <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line pt-5 pb-[max(20px,env(safe-area-inset-bottom))] font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase max-[560px]:tracking-[0.1em]">
      <span>© 2026 · Martin Zachariassen</span>
      {/* Required CC BY 4.0 attribution for the DB-IP City Lite dataset. */}
      <a
        href="https://db-ip.com"
        target="_blank"
        rel="noopener noreferrer"
        className="border-b border-line-2 pb-px transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        IP Geolocation by DB-IP
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <span>59°N · 10°E</span>
    </footer>
  );
}
