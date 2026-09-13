/* ════════════════════════════════════════════════
   One door for "share this with the community".

   The owner, on the pattern this replaces: "Share with the community"
   performed the share on the tap and reported "Shared with community".
   The person never saw what went out, could not change it, and had no
   idea where it landed.

   So a share is not an action any more; it is a DRAFT. This takes the
   person into the community composer with the thing already on it —
   the real card, as it will appear in the feed — and their words, which
   they can change or clear. Nothing is published until THEY press Share
   there. Backing out publishes nothing and returns them to where they
   came from. After Share they land on the post itself in the feed.

   A draft is carried in router state, never in the URL: a link that
   pre-fills somebody's composer is not something anybody should be able
   to send them, and a reload must not reopen a composer the person
   already closed.

   draft = { type, refId, payload, body }
     type     community_posts.post_type ("score", "puzzle_result", ...)
     refId    community_posts.ref_id, or null
     payload  the snapshot the feed card renders from
     body     the words to start with; the person can edit or clear them
   ════════════════════════════════════════════════ */

export const SHARE_DRAFT_PATH = "/app/community";

export function startShareDraft(navigate, draft) {
  navigate(SHARE_DRAFT_PATH, {
    state: {
      shareDraft: {
        type: draft.type,
        refId: draft.refId ?? null,
        payload: draft.payload || {},
        body: draft.body || "",
        at: Date.now(),
      },
    },
  });
}
