import {
  FindingList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@martinzachariassen/design";
import { Tip } from "../../lib/glossary.tsx";
import { isForeignPublicIp, webrtcLeak } from "../../lib/heuristics.ts";
import { ArrowLeft } from "../../lib/icons.tsx";
import type { WebRTCResult } from "../../types.ts";
import type { ReactNode } from "react";
import { Absent, Chip, type ChipTone, Finding, Footnote, SubLabel } from "../primitives.tsx";

// A WebRTC IP token — the shared <Chip> (design system <Badge>) with the leak/
// local tone mapping this section uses.
function Tag({ children, variant }: { children: ReactNode; variant?: "leak" | "local" }) {
  const tone: ChipTone = variant === "leak" ? "alert" : variant === "local" ? "local" : "default";
  return <Chip tone={tone}>{children}</Chip>;
}

// An IP tag with an optional trailing annotation, introduced by a left-pointing
// arrow icon (not a glyph in a string) so it reads "<ip> ← <note>".
function PublicTag({ ip, httpIp }: { ip: string; httpIp: string | undefined }) {
  const note = isForeignPublicIp(ip, httpIp)
    ? "differs"
    : ip === httpIp
      ? "matches HTTP"
      : null;
  return (
    <Tag variant={note === "differs" ? "leak" : undefined}>
      {ip}
      {note ? (
        <>
          <ArrowLeft />
          {note}
        </>
      ) : null}
    </Tag>
  );
}

function TagGroup({ children }: { children: ReactNode }) {
  return <div className="my-2 flex flex-wrap gap-[7px]">{children}</div>;
}

/** What the section heading says about itself while it's folded shut. */
export function webrtcSummary(webrtc: WebRTCResult, httpIp: string | undefined) {
  const { pub, lan, relay, mdns, candidates } = webrtc;
  if (pub.length === 0 && lan.length === 0 && relay.length === 0 && mdns === 0) {
    return { severity: "off" as const, text: "No candidates — WebRTC blocked or unavailable" };
  }
  const leak = webrtcLeak(webrtc, httpIp);
  const n = candidates.length;
  const counted = [
    `${n} candidate${n === 1 ? "" : "s"}`,
    pub.length ? `${pub.length} public` : null,
    lan.length ? `${lan.length} local` : null,
    mdns ? `${mdns} masked` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    severity: leak ? ("warn" as const) : ("ok" as const),
    text: leak ? `${counted} — one of them isn't your HTTP address` : counted,
  };
}

export function WebRTC({
  webrtc,
  httpIp,
}: {
  webrtc: WebRTCResult;
  httpIp: string | undefined;
}) {
  const { pub, lan, relay, mdns, candidates } = webrtc;

  if (pub.length === 0 && lan.length === 0 && relay.length === 0 && mdns === 0) {
    return (
      <Absent>
        No IP candidates exposed <Tip k="iceCandidate" /> — WebRTC may be blocked or unavailable in
        this browser.
      </Absent>
    );
  }

  const leak = webrtcLeak(webrtc, httpIp);

  return (
    <>
      <FindingList className="mb-4">
        {leak ? (
          <Finding severity="warn" tip="webrtcLeak" title="Different public IP exposed">
            WebRTC revealed a public address that differs from the one normal requests come from.
            If you expected all traffic to use one VPN exit, check your browser or VPN&rsquo;s
            WebRTC leak protection.
          </Finding>
        ) : (
          <Finding severity="ok" tip="webrtcLeak" title="No different public IP exposed">
            WebRTC did not reveal a public address other than the one this page was contacted
            from.
          </Finding>
        )}
      </FindingList>

      {pub.length > 0 ? (
        <>
          <SubLabel>Public IPs</SubLabel>
          <TagGroup>
            {pub.map((ip) => (
              <PublicTag key={ip} ip={ip} httpIp={httpIp} />
            ))}
          </TagGroup>
        </>
      ) : null}

      {lan.length > 0 ? (
        <>
          <SubLabel tip="lanIp">Local / LAN IPs</SubLabel>
          <TagGroup>
            {lan.map((ip) => (
              <Tag key={ip} variant="local">
                {ip}
              </Tag>
            ))}
          </TagGroup>
        </>
      ) : null}

      {relay.length > 0 ? (
        <>
          <SubLabel tip="turn">Relay candidates</SubLabel>
          <TagGroup>
            {relay.map((ip) => (
              <Tag key={ip}>{ip}</Tag>
            ))}
          </TagGroup>
        </>
      ) : null}

      {candidates.length > 0 ? (
        <>
          <SubLabel tip="iceCandidate">All candidates</SubLabel>
          {/* The design system's Table, which brings the focusable horizontal
              scroll container this needs (WCAG 2.1.1) — the hand-rolled version
              scrolled but couldn't be reached from the keyboard. The header row
              stays sr-only: three mono columns of addresses read fine without
              visible headings, but the relationship still has to be conveyed. */}
          <Table className="text-[13px]">
            <TableHeader className="sr-only">
              <TableRow>
                <TableHead>Candidate type</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c, i) => (
                <TableRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: candidate order is stable within a scan
                  key={i}
                >
                  <TableCell className="w-[22%] break-words align-top font-mono text-ink-soft">
                    {c.type}
                  </TableCell>
                  <TableCell className="break-words align-top font-mono">{c.address}</TableCell>
                  <TableCell className="w-[26%] break-words align-top font-mono text-ink-soft">
                    {c.scope}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}

      {mdns > 0 ? (
        <Footnote>
          {mdns} local candidate{mdns === 1 ? " was" : "s were"} hidden behind browser mDNS privacy
          masking <Tip k="mdns" />.
        </Footnote>
      ) : null}
    </>
  );
}
