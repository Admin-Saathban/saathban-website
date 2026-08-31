/* ════════════════════════════════════════════════
   A link in somebody's words is a place, not a string.

   A URL pasted into a post rendered as body text: five wrapped lines of
   "https://saathban-website-git-feature-app-basil-farooqs-projects…"
   in the middle of a sentence. Unreadable, unrecognisable as a link,
   and impossible to judge before tapping — which is the part that
   matters, because the app already warns people about money talk in
   messages and the same people receive links.

   So a URL becomes a CHIP: the domain said plainly, the rest of the
   address kept but quiet, on one line that cannot wrap into a wall.

   NO FETCH. Titles and images would need a request per link, from the
   client, to a stranger's server — which leaks the reader's IP and the
   fact that they opened the message, and costs a round trip on a phone
   before anything can be drawn. The domain is the part a person needs
   in order to decide, and it is knowable without asking anybody.

   WHAT IS DELIBERATELY NOT HIDDEN: the full address stays in the title
   attribute and the chip never shows a different domain from the one it
   opens. A link chip that displays a friendly name over a hostile
   address is a phishing affordance, and this app's readers are exactly
   the people that is built for.
   ════════════════════════════════════════════════ */

import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import Icon from "../components/Icon.jsx";

/* http(s) links, and bare www.something.tld — the second because people
   paste what they see, and "www.saathban.org" is a link to a reader
   whatever the protocol says. Trailing punctuation is left OUT of the
   match: a sentence ending "…see saathban.org." must not produce a link
   with a full stop inside it. */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"])/gi;

export function splitLinks(text) {
  const out = [];
  if (typeof text !== "string" || !text) return out;
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "link", value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export function hasLink(text) {
  return typeof text === "string" && URL_RE.test(text.replace(URL_RE, (s) => s));
}

function parts(raw) {
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(href);
    const rest = (u.pathname === "/" ? "" : u.pathname) + u.search;
    return { href, host: u.hostname.replace(/^www\./i, ""), rest };
  } catch {
    return { href, host: raw, rest: "" };
  }
}

export function LinkChip({ raw }) {
  const { href, host, rest } = parts(raw);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      title={href}
      className="sb-press"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "100%",
        minHeight: A11Y.minTapTargetPx,
        padding: "6px 12px",
        margin: "4px 0",
        borderRadius: 12,
        background: C.comment,
        border: `1px solid ${C.commentRule}`,
        color: C.textMain,
        textDecoration: "none",
        fontSize: 16,
        /* One line, always. The whole reason this exists is that the
           raw address wrapped into five. */
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <Icon name="globe" size={18} style={{ flexShrink: 0, color: C.commentRule }} />
      {/* THE HOST SHRINKS LAST, AND ELLIPSISES WHEN IT MUST.

          flexShrink: 0 clipped it hard at the chip edge — a domain cut
          mid-word with no ellipsis, so a reader could neither read it
          nor tell it had been cut. That is worse than the wrapped raw
          URL this replaced: at least five lines were honest about being
          the whole address.

          The path gives way first (shrink 3) because the domain is the
          part that decides whether to tap. */}
      <span
        style={{
          fontWeight: 700,
          flex: "0 1 auto",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {host}
      </span>
      {rest ? (
        <span
          style={{
            color: C.textMuted,
            flex: "0 3 auto",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          {rest}
        </span>
      ) : null}
    </a>
  );
}

/* Text with its links drawn as chips. Used for post bodies, comments and
   messages — one implementation, because three would drift and only one
   of them would get the phishing rule right. */
export default function RichText({ text }) {
  const bits = splitLinks(text);
  if (!bits.length) return null;
  return (
    <>
      {bits.map((b, i) =>
        b.type === "link"
          ? <LinkChip key={i} raw={b.value} />
          : <span key={i}>{b.value}</span>
      )}
    </>
  );
}
