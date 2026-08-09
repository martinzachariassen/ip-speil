import { Container, Link } from "@martinzachariassen/design";

/**
 * The colophon, and nothing else.
 *
 * The two `curl` lines that used to sit above it are gone — the routes are still
 * real (the Worker content-negotiates `/` and serves the bare IP to terminals),
 * they just don't need a block of the page to advertise themselves.
 */
export function Footer() {
  return (
    <footer className="mt-9 border-line border-t pt-6 pb-11">
      <Container size="full" gutter="none">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint">
          {/* Inside a sentence, so these take the underlined `default` variant —
              colour alone would leave them indistinguishable from the text
              around them (WCAG 1.4.1). The standalone links can stay quiet. */}
          <span>
            © 2026 ·{" "}
            <Link href="https://mlz.no" external>
              Martin Zachariassen
            </Link>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Built on{" "}
            <Link href="https://github.com/martinzachariassen/mlz-design" external>
              mlz-design
            </Link>
          </span>
          <span aria-hidden="true">·</span>
          {/* Required CC BY 4.0 attribution for the DB-IP City Lite dataset. */}
          <Link href="https://db-ip.com" external variant="quiet">
            IP Geolocation by DB-IP
          </Link>
          <span aria-hidden="true">·</span>
          <span>No logs, no cookies, no tracking</span>
        </p>
      </Container>
    </footer>
  );
}
