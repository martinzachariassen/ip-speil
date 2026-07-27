import { cx } from "../../lib/cx.ts";
import { isForeignPublicIp, webrtcLeak } from "../../lib/heuristics.ts";
import type { WebRTCResult } from "../../types.ts";
import type { ReactNode } from "react";
import { BodyIntro, Note, SubLabel } from "../primitives.tsx";

const TAG_BASE =
  "rounded-[7px] border border-line-2 px-2 py-1 font-mono text-[12px] break-words text-ink";

function Tag({ children, variant }: { children: ReactNode; variant?: "leak" | "local" }) {
  return (
    <span
      className={cx(
        TAG_BASE,
        variant === "leak" && "border-accent text-accent",
        variant === "local" && "border-dashed",
      )}
    >
      {children}
    </span>
  );
}

function PublicTag({ ip, httpIp }: { ip: string; httpIp: string | undefined }) {
  if (isForeignPublicIp(ip, httpIp)) return <Tag variant="leak">{ip} ← differs</Tag>;
  if (ip === httpIp) return <Tag>{ip} ← matches HTTP</Tag>;
  return <Tag>{ip}</Tag>;
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
          title="Different public IP exposed"
          desc="WebRTC revealed a public address that differs from the one seen by normal HTTP requests."
        />
      ) : (
        <Note
          severity="ok"
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
          <SubLabel>Local / LAN IPs</SubLabel>
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
          <SubLabel>Relay candidates</SubLabel>
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
          masking.
        </BodyIntro>
      ) : null}

      {candidates.length > 0 ? (
        <>
          <SubLabel>All candidates</SubLabel>
          {candidates.map((c, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: candidate order is stable within a scan
              key={i}
              className="grid grid-cols-[minmax(56px,0.4fr)_minmax(0,1fr)_minmax(70px,0.5fr)] gap-2.5 border-b border-dashed border-line py-[7px] text-[12px] last:border-b-0 max-[560px]:grid-cols-1 max-[560px]:gap-0.5"
            >
              <span className="break-words font-mono text-ink-faint">{c.type}</span>
              <span className="break-words font-mono">{c.address}</span>
              <span className="break-words font-mono text-ink-faint">{c.scope}</span>
            </div>
          ))}
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
