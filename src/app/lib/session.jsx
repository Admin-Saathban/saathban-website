/* ════════════════════════════════════════════════
   Session guarding — who is signed in, what their profile says,
   and where each role belongs.

   <AuthProvider> wraps the /app route table once (see
   SESSION_WIRING.md at the repo root for the AppRoot diff) and holds
   the Supabase session plus the signed-in profile row. Components
   read both through:

     const { session, profile, loading, refreshProfile } = useSession();

   <RequireAuth roles={["saath_icon"]}> guards a route element:
   resolving → quiet loading state; signed out → login; signed in but
   no profile row → the finish-mode signup forms; wrong role → that
   role's own home. RLS remains the real boundary — this wrapper is
   navigation, not security.

   roleHomePath(role) is the ONE place the after-login destination per
   role lives. When the Saath-Fam and Saath-Buddy dashboards land,
   point their roles at the real routes here and delete the Welcome
   placeholder.

   ─── OPENING WITH NO NETWORK ───

   Home used to wait on the profile fetch, which is a network round
   trip, so an Icon on patchy data opened the app to a blank ground.
   Now the provider starts from what the phone already holds:

   - THE SESSION ON THE DEVICE (lib/offline.js readStoredSession). With
     an expired access token and no network, supabase-js retries a
     refresh for up to thirty seconds and then answers null — but it
     leaves the session in storage, because it has not been refused.
     So null with a stored session is "unreachable", not "signed out",
     and the stored session stands. Only SIGNED_OUT (pressing Sign out,
     or the server actually refusing the refresh token — the client
     removes the stored session before it says so) ends it.

   - THE LAST PROFILE ROW, cached per person under
     saathban.app.profile.<id>. It paints the first frame; the fresh row
     replaces it when it lands. A refresh that fails keeps the cached
     row on screen (profileRefreshFailed) instead of the retry screen.

   A definitive "no profile row" is only believed from a query made
   with a LIVE session: an expired token sends the anon key, row
   security returns nothing, and that nothing is not absence.
   ════════════════════════════════════════════════ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { APP_COLORS as C } from "../../shared/tokens.js";
import supabase from "./supabase.js";
import { useI18n } from "./i18n.jsx";
import {
  PROFILE_CACHE_PREFIX,
  isOnline,
  readStoredSession,
  readUserCache,
  removeUserCache,
  writeUserCache,
} from "./offline.js";

export function roleHomePath(role) {
  switch (role) {
    case "saath_icon":
      return "/app/home";
    case "admin":
      return "/app/admin";
    case "family_member":
      return "/app/fam";
    case "saath_buddy":
      return "/app/buddy";
    default:
      return "/app/auth/welcome";
  }
}

/* ── Post-login return ─────────────────────────────────────────
   RequireAuth sends the blocked path along when it bounces someone
   to login (state.from); the login screen stashes it here, and the
   Complete screen / finish-mode forms consume it once the role is
   known. sessionStorage survives the magic-link email round-trip in
   the same browser, which router state cannot. */

const FROM_KEY = "saathban.auth.from";

// Areas owned by a single role. Any other /app path (settings, the
// front door) is neutral and fine for every signed-in role; the auth
// flow itself never qualifies — returning into it would loop.
const ROLE_AREAS = [
  ["/app/home", "saath_icon"],
  ["/app/circle", "saath_icon"],
  ["/app/admin", "admin"],
  ["/app/fam", "family_member"],
  ["/app/vetting", "saath_buddy"],
  ["/app/buddy", "saath_buddy"],
];

export function rememberPostLoginPath(path) {
  if (!path || !path.startsWith("/app") || path.startsWith("/app/auth")) return;
  try {
    sessionStorage.setItem(FROM_KEY, path);
  } catch {
    /* storage unavailable — the role home is a fine fallback */
  }
}

function pathAllowedForRole(path, role) {
  if (!path || !path.startsWith("/app") || path.startsWith("/app/auth")) return false;
  const area = ROLE_AREAS.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`)
  );
  return area ? area[1] === role : true;
}

/* Where to go after a successful sign-in: back to the page that
   bounced the person here if their role may see it, else their
   role's own home. Clears the stash either way. */
export function consumePostLoginPath(role) {
  let from = null;
  try {
    from = sessionStorage.getItem(FROM_KEY);
    sessionStorage.removeItem(FROM_KEY);
  } catch {
    /* ditto */
  }
  return pathAllowedForRole(from, role) ? from : roleHomePath(role);
}

const AuthContext = createContext(null);

function cachedProfileFor(uid) {
  const row = readUserCache(PROFILE_CACHE_PREFIX, uid)?.data;
  return row && row.id === uid ? row : null;
}

/* What the first frame can know without asking anybody. */
function bootState() {
  const stored = readStoredSession();
  if (!stored) {
    return { session: undefined, profile: { status: "loading", row: null, fresh: false, failed: false } };
  }
  const row = cachedProfileFor(stored.user.id);
  return {
    session: stored,
    profile: row
      ? { status: "ready", row, fresh: false, failed: false }
      : { status: "loading", row: null, fresh: false, failed: false },
  };
}

/* null from the client while the session is still on the phone means
   the client could not reach the server, not that it was refused. */
function resolveSession(event, sess) {
  if (sess) return sess;
  if (event === "SIGNED_OUT") return null;
  return readStoredSession();
}

export function AuthProvider({ children }) {
  const [boot] = useState(bootState);
  // undefined = still resolving; null = definitively absent.
  const [session, setSession] = useState(boot.session);
  /* The profile is a STATUS, not a nullable row — a failed fetch must
     never be mistaken for "this account has no profile" (that mistake
     used to greet existing accounts with the signup role-picker):
       loading — a fetch is in flight (or none started yet)
       ready   — the row is here (fresh: from the server this page life;
                 otherwise the copy this phone kept)
       absent  — the authed query definitively returned no row
       error   — the fetch failed and there is no copy; retry, never
                 conclude absence */
  const [profileState, setProfileState] = useState(boot.profile);
  // Skip profile refetches on token refreshes for the same person.
  const profileUserRef = useRef(null);
  const freshRef = useRef(false);
  freshRef.current = profileState.fresh;
  const loadingRef = useRef(false);

  const loadGeneration = useRef(0);

  const loadProfile = useCallback(async (sess, { force = false } = {}) => {
    if (!sess) {
      profileUserRef.current = null;
      setProfileState({ status: "absent", row: null, fresh: false, failed: false });
      return;
    }
    // One load per signed-in person: auth events (INITIAL_SESSION,
    // SIGNED_IN, token refreshes) must not restart a finished — or
    // in-flight — load. Manual retry passes force.
    if (!force && profileUserRef.current === sess.user.id) return;
    const uid = sess.user.id;
    profileUserRef.current = uid;
    const generation = ++loadGeneration.current;
    const stale = () => generation !== loadGeneration.current;
    /* Keep what is on screen for THIS person; a different person never
       inherits it, and gets their own copy or the loading state. */
    setProfileState((p) => {
      if (p.row && p.row.id === uid) return { ...p, failed: false };
      const row = cachedProfileFor(uid);
      return row
        ? { status: "ready", row, fresh: false, failed: false }
        : { status: "loading", row: null, fresh: false, failed: false };
    });
    /* The four-second abort exists so a hung request does not hold the
       resolving screen. With the phone's copy already on screen nothing
       is being held, and on a genuinely slow connection four seconds is
       less than one request takes — so the copy gets a longer wait and
       the line says "slow" rather than "no connection". */
    const timeoutMs = cachedProfileFor(uid) ? 15000 : 4000;
    loadingRef.current = true;
    try {
      // Errors and timeouts get retried with backoff before surfacing;
      // a clean empty is re-read once in case of a transient blip.
      const delaysMs = [0, 400, 1200];
      let lastError = null;
      for (const delay of delaysMs) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (stale()) return;
        // No network at all: nothing to wait for. The 'online' listener
        // below tries again the moment there is.
        if (!isOnline()) {
          lastError = new Error("offline");
          break;
        }
        try {
          // A hung request must surface as an error promptly, not hold
          // the resolving screen for the browser's own network timeout.
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", uid)
            .abortSignal(AbortSignal.timeout(timeoutMs))
            .maybeSingle();
          if (error) throw error;
          lastError = null;
          if (data) {
            writeUserCache(PROFILE_CACHE_PREFIX, uid, data);
            if (!stale()) setProfileState({ status: "ready", row: data, fresh: true, failed: false });
            return;
          }
        } catch (e) {
          lastError = e;
        }
      }
      if (stale()) return;
      if (!lastError) {
        /* Empty twice. Believed only if the client holds a live session —
           with an expired token the query went out as anon and row
           security answered for a stranger. */
        let live = null;
        try {
          live = (await supabase.auth.getSession()).data?.session ?? null;
        } catch {
          live = null;
        }
        if (stale()) return;
        if (!live || live.user?.id !== uid) lastError = new Error("no live session");
      }
      if (lastError) {
        setProfileState((p) =>
          p.row && p.row.id === uid
            ? { ...p, failed: true }
            : { status: "error", row: null, fresh: false, failed: true }
        );
      } else {
        removeUserCache(PROFILE_CACHE_PREFIX, uid);
        setProfileState({ status: "absent", row: null, fresh: false, failed: false });
      }
    } finally {
      if (!stale()) loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const next = resolveSession(null, data.session);
      setSession(next ?? null);
      loadProfile(next);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!alive) return;
      const next = resolveSession(event, sess);
      setSession(next ?? null);
      /* A session that has just become usable again (a refresh that
         finally went through after the connection came back) is the
         moment to fetch a profile that has so far only come from the
         phone's copy. */
      const revived =
        sess && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") &&
        profileUserRef.current === sess.user.id && !freshRef.current && !loadingRef.current;
      loadProfile(next, { force: Boolean(revived) });
    });

    /* Back online with a profile that never arrived fresh: ask again,
       without anybody having to press anything. */
    const onOnline = () => {
      if (freshRef.current || loadingRef.current) return;
      const stored = readStoredSession();
      if (stored) loadProfile(stored, { force: true });
    };
    window.addEventListener("online", onOnline);

    return () => {
      alive = false;
      subscription.unsubscribe();
      window.removeEventListener("online", onOnline);
    };
  }, [loadProfile]);

  /* THE PERSON'S OWN DAY. Since 0140 the server works out "today", the
     48-hour log window and every streak from profiles.timezone. The phone
     knows where it is; when that differs from what the profile says (a
     first sign-in, a trip, a clock moved), the person's own row is
     brought into step once per session. A name the database does not
     recognise is dropped by its trigger, and this does not try again.
     Only against a row fresh from the server: the phone's copy may be
     out of date, and an update sent while offline would simply fail and
     use up the one attempt. */
  const tzTried = useRef(null);
  useEffect(() => {
    const row = profileState.row;
    if (!row || !profileState.fresh) return;
    let tz = null;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      tz = null;
    }
    if (!tz || row.timezone === tz) return;
    const attempt = row.id + "|" + tz;
    if (tzTried.current === attempt) return;
    tzTried.current = attempt;
    supabase
      .from("profiles")
      .update({ timezone: tz })
      .eq("id", row.id)
      .then(({ error }) => {
        if (error) return;
        setProfileState((p) => {
          if (!p.row || p.row.id !== row.id) return p;
          const next = { ...p.row, timezone: tz };
          writeUserCache(PROFILE_CACHE_PREFIX, row.id, next);
          return { ...p, row: next };
        });
      });
  }, [profileState.row, profileState.fresh]);

  // For screens that change the profile (finish forms, future
  // Settings) so guards see the new row without a reload.
  const refreshProfile = useCallback(async () => {
    const {
      data: { session: sess },
    } = await supabase.auth.getSession();
    await loadProfile(resolveSession(null, sess), { force: true });
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      session: session ?? null,
      profile: profileState.row,
      profileStatus: profileState.status,
      /* true once the row on screen came from the server in this page
         life; false while it is the copy this phone kept. */
      profileFresh: profileState.fresh,
      /* the last attempt to refresh the row failed (offline, or nothing
         answering) — the kept copy is still what is shown */
      profileRefreshFailed: profileState.failed,
      loading:
        session === undefined ||
        (Boolean(session) && profileState.status === "loading"),
      refreshProfile,
    }),
    [session, profileState, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <AuthProvider> (see SESSION_WIRING.md)");
  }
  return ctx;
}

/* Deliberately wordless (renders before any locale-aware shell) and
   marked busy for assistive tech. */
function ResolvingSession() {
  return (
    <div
      aria-busy="true"
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMuted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 28,
        letterSpacing: "0.3em",
      }}
    >
      ···
    </div>
  );
}

/* Signed in, but the profile fetch keeps failing (offline, flaky
   network) and this phone has no copy of it yet — a first open with no
   connection. Never the signup picker — the account may well exist.
   In the person's language (the provider only renders once it has
   arrived), and it tries again by itself when the connection returns.
   onRetryOverride lets screens with their own retry path (Complete)
   reuse this exact state. */
export function AccountLoadError({ onRetryOverride }) {
  const { refreshProfile } = useSession();
  const { t, ts } = useI18n();
  const retry = onRetryOverride || refreshProfile;
  const [busy, setBusy] = useState(false);
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.textMain,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <p aria-hidden="true" style={{ fontSize: 40, margin: "0 0 10px" }}>🌦️</p>
        <p role="status" style={{ fontSize: ts(20), lineHeight: 1.6, color: C.textMain, margin: "0 0 22px" }}>
          {t("common.loadError")}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await retry();
            } finally {
              setBusy(false);
            }
          }}
          style={{
            minHeight: 48,
            padding: "0 32px",
            borderRadius: 50,
            border: "none",
            background: C.green,
            color: C.cream,
            fontSize: ts(18),
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "…" : t("feedback.retry")}
        </button>
      </div>
    </main>
  );
}

export function RequireAuth({ roles, children }) {
  const { session, profile, profileStatus, loading } = useSession();
  const location = useLocation();

  if (loading) return <ResolvingSession />;
  if (!session) {
    return (
      <Navigate
        to="/app/auth/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  // A fetch failure is NOT absence: hold the door with a retry state.
  if (profileStatus === "error") return <AccountLoadError />;
  // Only a definitive "no row" from an authed query goes to finish-mode.
  if (!profile) return <Navigate to="/app/auth?finish=1" replace />;
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={roleHomePath(profile.role)} replace />;
  }
  return children;
}
