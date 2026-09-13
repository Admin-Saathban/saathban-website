/* ════════════════════════════════════════════════
   Screens that are downloaded when they are needed.

   The app used to be one 1.86MB script, so a person opening Home on a
   phone downloaded and parsed the admin console, the Buddy vetting
   form, the parked ludo and snakes boards and every other screen first.
   Those now arrive as separate chunks.

   ─── WHY NOT React.lazy ───

   React.lazy suspends on its first render EVEN WHEN the chunk has
   already been fetched: it only learns the module is there by awaiting
   the promise, which costs a render. Here that one render is visible —
   a tab pane pre-mounted at idle, or a tab tapped after its chunk was
   preloaded, would still flash the placeholder for a frame.

   lazyScreen remembers the loaded component, so once .preload() has
   finished the screen renders synchronously, exactly as an ordinary
   import would. Before that it suspends like React.lazy does.

   ─── FAILURE ───

   A chunk that cannot be fetched (offline, or a file from a build the
   server no longer has) throws to ScreenLoadBoundary, which says so in
   the person's language and offers a reload. main.jsx separately reloads
   onto the current build once when online. Any OTHER error passes
   straight through the boundary, so this changes nothing about how a
   genuine bug surfaces.
   ════════════════════════════════════════════════ */

import { Component } from "react";
import { APP_COLORS as C, A11Y } from "../../shared/tokens.js";
import { useI18n } from "./i18n.jsx";

export function lazyScreen(loader) {
  let Loaded = null;
  let pending = null;
  let failure = null;

  const load = () => {
    if (Loaded) return Promise.resolve(Loaded);
    if (!pending) {
      pending = loader().then(
        (m) => {
          Loaded = m.default;
          return Loaded;
        },
        (e) => {
          failure = e;
          pending = null;
          throw e;
        }
      );
    }
    return pending;
  };

  function Screen(props) {
    if (Loaded) return <Loaded {...props} />;
    if (failure) {
      const e = failure;
      failure = null;
      throw e;
    }
    throw load();
  }
  Screen.preload = () => load().catch(() => null);
  return Screen;
}

/* Runs fn once the browser has nothing better to do — and, on a phone
   that never goes idle while painting, after `timeout` at the latest. */
export function whenIdle(fn, timeout = 4000) {
  if (typeof window === "undefined") return () => {};
  const ric = window.requestIdleCallback;
  const id = ric ? ric(fn, { timeout }) : window.setTimeout(fn, Math.min(timeout, 1500));
  return () => {
    if (ric) window.cancelIdleCallback?.(id);
    else window.clearTimeout(id);
  };
}

/* The quiet placeholder while a screen's chunk is on its way: the app's
   own ground and nothing else, so the arrival reads as the page filling
   in rather than as a flash. Wordless, like the session placeholder. */
export function ScreenArriving() {
  return <div aria-busy="true" style={{ minHeight: "100vh", background: C.bg }} />;
}

const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS|Failed to fetch/i;

function ScreenLoadFailed() {
  const { t, ts } = useI18n();
  return (
    <main
      role="alert"
      style={{
        minHeight: "60vh",
        background: C.bg,
        color: C.textMain,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, fontSize: ts(A11Y.minBodyPx) }}>{t("common.loadError")}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          minHeight: A11Y.minTapTargetPx,
          padding: "0 28px",
          borderRadius: 50,
          border: "none",
          background: C.green,
          color: C.cream,
          fontSize: ts(A11Y.minBodyPx),
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {t("feedback.retry")}
      </button>
    </main>
  );
}

/* resetKey: pass the pathname, so moving somewhere else tries again. */
export class ScreenLoadBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      if (!CHUNK_ERROR.test(String(error && error.message))) throw error;
      return <ScreenLoadFailed />;
    }
    return this.props.children;
  }
}
