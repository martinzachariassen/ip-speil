import { Code, Container, Link, Text } from "@martinzachariassen/design";

/**
 * The colophon, plus the thing regulars actually want from this site: the two
 * `curl` lines. Both routes are real — the Worker content-negotiates `/` and
 * serves the bare IP to terminals — so they're documented rather than decorative.
 */
export function Footer() {
  return (
    <footer className="mt-9 border-line border-t pt-6 pb-11">
      <Container size="full" gutter="none">
        <Text variant="eyebrow" as="p" className="mb-3 tracking-[0.18em]">
          From the terminal
        </Text>

        <dl className="m-0 grid gap-1.5 font-mono text-[13px] text-ink-soft">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <dt>
              <Code>curl ip.mlz.no</Code>
            </dt>
            <dd className="m-0">→ just the address, plain text</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <dt>
              <Code>curl ip.mlz.no/json</Code>
            </dt>
            <dd className="m-0">→ everything on this page</dd>
          </div>
        </dl>

        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-faint">
          <span>© 2026 · Martin Zachariassen</span>
          <span aria-hidden="true">·</span>
          {/* Inside a sentence, so it takes the underlined `default` variant —
              colour alone would leave it indistinguishable from the text
              around it (WCAG 1.4.1). The standalone links below can stay quiet. */}
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
