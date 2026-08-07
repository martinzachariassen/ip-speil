import { Icon } from "@martinzachariassen/design";
import { Tip } from "../../lib/glossary.tsx";
import { isForeignPublicIp, webrtcLeak } from "../../lib/heuristics.ts";
import type { WebRTCResult } from "../../types.ts";
import type { ReactNode } from "react";
import { BodyIntro, Chip, type ChipTone, Note, SubLabel } from "../primitives.tsx";

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
          <Icon name="arrow-left" size="xs" className="flex-none" />
          {note}
        </>
      ) : null}
    </Tag>
  );
}

function TagGroup({ children }: { children: ReactNode }) {
  return <div className="my-2 flex flex-wrap gap-[7px]">{children}</div>;
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
      <Note
        severity="off"
        tip="iceCandidate"
        title="No IP candidates exposed"
        desc="WebRTC may be blocked or unavailable in this browser."
      />
    );
  }

  const leak = webrtcLeak(webrtc, httpIp);

  return (
    <>
      {leak ? (
        <Note
          severity="warn"
          tip="webrtcLeak"
          title="Different public IP exposed"
          desc="WebRTC revealed a public address that differs from the one seen by normal HTTP requests."
        />
      ) : (
        <Note
          severity="ok"
          tip="webrtcLeak"
          title="No different public IP exposed"
          desc="WebRTC did not reveal a public IP different from your HTTP IP."
        />
      )}

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

      {mdns > 0 ? (
        <BodyIntro>
          {mdns} local candidate{mdns === 1 ? " was" : "s were"} hidden behind browser mDNS privacy
          masking <Tip k="mdns" />.
        </BodyIntro>
      ) : null}

      {candidates.length > 0 ? (
        <>
          <SubLabel tip="iceCandidate">All candidates</SubLabel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] border-collapse text-[13px]">
              <thead className="sr-only">
                <tr>
                  <th scope="col">Candidate type</th>
                  <th scope="col">Address</th>
                  <th scope="col">Scope</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, i) => (
                  <tr
                    // biome-ignore lint/suspicious/noArrayIndexKey: candidate order is stable within a scan
                    key={i}
                    className="border-b border-dashed border-line last:border-b-0"
                  >
                    <td className="w-[22%] break-words py-[7px] pr-2.5 align-top font-mono text-ink-soft">
                      {c.type}
                    </td>
                    <td className="break-words py-[7px] pr-2.5 align-top font-mono">{c.address}</td>
                    <td className="w-[26%] break-words py-[7px] align-top font-mono text-ink-soft">
                      {c.scope}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {leak ? (
        <BodyIntro>
          If you expected all traffic to use one VPN exit, check your browser or VPN WebRTC leak
          protection.
        </BodyIntro>
      ) : null}
    </>
  );
}
