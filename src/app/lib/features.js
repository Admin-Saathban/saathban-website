/* ════════════════════════════════════════════════
   Features that are built but parked — one switch each, in one place.

   MEDIA_UPLOADS — attaching a photo (or a video) to something other
   people will see. OWNER RULING, 2026-09-13: parked. Nobody can attach
   a picture to a post, a message or a group, anywhere in the app.

   What it does NOT touch, by the same ruling:
   · VOICE NOTES stay (posts, messages, the daily log).
   · PROFILE PHOTOS stay (Profile, the games player card).
   · Documents a Buddy is asked for during vetting stay — that is an
     identity check, not something shared.
   · PHOTOS ALREADY POSTED STILL DISPLAY. Only the ways to add a new
     one are hidden; every reader of image_path is untouched.

   The code behind each entry point is kept, not deleted, and every
   entry point reads THIS constant — so turning uploads back on is
   changing `false` to `true` here and nothing else.

   Entry points that read it:
   · community/Composer.jsx  — the camera button on the feed's "write
     something" row, and the Photo chip inside the full composer (the
     same composer Home and the Feed both open).
   · people/ThreadPage.jsx   — the Photo button in a conversation, and
     the two hidden file inputs (camera, gallery) it opened.
   · groups/GroupManage.jsx  — "Use a photo of your own" for a group's
     cover. The drawn covers remain, so a group still has one.

   NOT AN ACCESS CONTROL. The database and storage still accept an
   image_path on posts and messages and an upload into the buckets; this
   is the app declining to offer it. Closing it server-side would be a
   migration and a storage policy, and is a separate decision.
   ════════════════════════════════════════════════ */

export const MEDIA_UPLOADS = false;
