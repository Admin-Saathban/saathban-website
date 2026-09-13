/* Media uploads parked (English). Deep-merged over en.js at load.

   Photo and video attachments are parked (lib/features.js, MEDIA_UPLOADS).
   Only lines that OFFERED a photo change here; the strings behind the
   parked controls stay in en.js so switching uploads back on needs no
   copy work. */
export default {
  people: {
    thread: {
      /* Was "…You can still send a photo or write." — there is no photo
         to send now, so the fallback names only what is really there. */
      voiceUnsupported: "This browser cannot record here. You can still write a message or send a sticker.",
    },
  },
};
