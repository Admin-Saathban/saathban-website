/* Placeholder landing for /app.
   Exists to prove the router, the shared tokens, and the accessibility
   floors are wired end to end. Build step 3 replaces this with the role
   selection screen. */

import { COLORS as C, FONTS, A11Y } from "../../shared/tokens.js";

export default function AppHome() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: FONTS.sans,
        color: C.textMain,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <img
          src="/logo-extended.png"
          alt="Saathban"
          style={{ height: 56, width: "auto", marginBottom: 28 }}
        />

        <h1
          style={{
            fontFamily: FONTS.serif,
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
            fontWeight: 700,
            color: C.green,
            lineHeight: 1.2,
            marginBottom: 16,
          }}
        >
          Timeless Togetherness
        </h1>

        <p
          style={{
            fontSize: A11Y.minBodyPx,
            lineHeight: 1.7,
            color: C.textMuted,
            marginBottom: 32,
          }}
        >
          This is where the Saathban app will live. It is still being built —
          there is nothing to sign in to just yet.
        </p>

        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: A11Y.minTapTargetPx,
            padding: "0 32px",
            borderRadius: 50,
            background: C.green,
            color: C.cream,
            fontSize: A11Y.minBodyPx,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Back to saathban.com
        </a>
      </div>
    </main>
  );
}
