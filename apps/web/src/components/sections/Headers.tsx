import { FindingList } from "@martinzachariassen/design";
import {
  anyClientHintAnswered,
  clientHintsStatus,
  isClientHintHeader,
} from "../../lib/client-hints.ts";
import type { HeaderMap } from "../../types.ts";
import {
  Absent,
  BodyIntro,
  Finding,
  KV,
  KVList,
  Mono,
  Muted,
  type Severity,
  SubLabel,
} from "../primitives.tsx";

const PRIORITY = [
  "user-agent",
  "accept-language",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-site",
  "sec-fetch-mode",
  "dnt",
  "referer",
];

// The high-entropy hints we asked for (Accept-CH) get their own block, so the
// user can see what the browser volunteered on request versus what it always
// sends.
function ClientHintsBlock({ headers }: { headers: HeaderMap }) {
  const statuses = clientHintsStatus(headers);

  return (
    <>
      <SubLabel tip="clientHints">Client Hints this site requested</SubLabel>
      <BodyIntro>
        These weren&rsquo;t sent automatically: this page asked with an <Mono>Accept-CH</Mono>{" "}
        header, and a Chromium-based browser answers on its next request without prompting you.
      </BodyIntro>
      {!anyClientHintAnswered(headers) ? (
        <FindingList>
          <Finding severity="ok" title="No high-entropy hints returned">
            Your browser didn&rsquo;t answer the request — typical of Firefox and Safari, which
            don&rsquo;t support these hints.
          </Finding>
        </FindingList>
      ) : (
        <KVList>
          {statuses.map((s) => (
            <KV key={s.header} k={s.header}>
              {s.value !== null ? <Mono>{s.value}</Mono> : <Muted>— not sent</Muted>}
            </KV>
          ))}
        </KVList>
      )}
    </>
  );
}

export function headersSummary(headers: HeaderMap): { severity: Severity; text: string } {
  return {
    severity: "off",
    text: `${Object.keys(headers).length} headers were sent to this page unprompted`,
  };
}

export function Headers({ headers }: { headers: HeaderMap }) {
  // Pull the solicited high-entropy hints out of the general list.
  const entries = Object.entries(headers).filter(([k]) => !isClientHintHeader(k));
  entries.sort(([a], [b]) => {
    const ai = PRIORITY.indexOf(a);
    const bi = PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <>
      <BodyIntro>
        Other sites may receive a slightly different set, depending on browser policy, permissions
        and server opt-ins.
      </BodyIntro>
      {entries.length ? (
        <KVList>
          {entries.map(([k, v]) => (
            <KV key={k} k={k}>
              <Mono>{Array.isArray(v) ? v.join(", ") : v}</Mono>
            </KV>
          ))}
        </KVList>
      ) : (
        <Absent>The headers endpoint returned no visible headers.</Absent>
      )}
      <ClientHintsBlock headers={headers} />
    </>
  );
}
