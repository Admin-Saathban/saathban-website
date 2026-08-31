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

export function AuthProvider({ children }) {
  // undefined = still resolving; null = definitively absent.
  const [session, setSession] = useState(undefined);
  /* The profile is a STATUS, not a nullable row — a failed fetch must
     never be mistaken for "this account has no profile" (that mistake
     used to greet existing accounts with the signup role-picker):
       loading — a fetch is in flight (or none started yet)
       ready   — the row is here
       absent  — the authed query definitively returned no row
       error   — the fetch failed; retry, never conclude absence */
  const [profileState, setProfileState] = useState({ status: "loading", row: null });
  // Skip profile refetches on token refreshes for the same person.
  const profileUserRef = useRef(null);

  const loadGeneration = useRef(0);

  const loadProfile = useCallback(async (sess, { force = false } = {}) => {
    if (!sess) {
      profileUserRef.current = null;
      setProfileState({ status: "absent", row: null });
      return;
    }
    // One load per signed-in person: auth events (INITIAL_SESSION,
    // SIGNED_IN, token refreshes) must not restart a finished — or
    // in-flight — load. Manual retry passes force.
    if (!force && profileUserRef.current === sess.user.id) return;
    profileUserRef.current = sess.user.id;
    const generation = ++loadGeneration.current;
    const stale = () => generation !== loadGeneration.current;
    setProfileState((p) => (p.status === "ready" ? p : { status: "loading", row: null }));
    // Errors and timeouts get retried with backoff before surfacing;
    // a clean empty is re-read once in case of a transient blip.
    const delaysMs = [0, 400, 1200];
    let lastError = null;
    for (const delay of delaysMs) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (stale()) return;
      try {
        // A hung request must surface as an error promptly, not hold
        // the resolving screen for the browser's own network timeout.
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", sess.user.id)
          .abortSignal(AbortSignal.timeout(4000))
          .maybeSingle();
        if (error) throw error;
        lastError = null;
        if (data) {
          if (!stale()) setProfileState({ status: "ready", row: data });
          return;
        }
      } catch (e) {
        lastError = e;
      }
    }
    if (stale()) return;
    setProfileState(
      lastError
        ? { status: "error", row: null }
        : { status: "absent", row: null }
    );
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      loadProfile(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!alive) return;
      setSession(sess ?? null);
      loadProfile(sess);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // For screens that change the profile (finish forms, future
  // Settings) so guards see the new row without a reload.
  const refreshProfile = useCallback(async () => {
    const {
      data: { session: sess },
    } = await supabase.auth.getSession();
    await loadProfile(sess, { force: true });
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      session: session ?? null,
      profile: profileState.row,
      profileStatus: profileState.status,
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
   network). Never the signup picker — the account may well exist.
   onRetryOverride lets screens with their own retry path (Complete)
   reuse this exact state. */
export function AccountLoadError({ onRetryOverride }) {
  const { refreshProfile } = useSession();
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
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.green, margin: "0 0 10px" }}>
          Loading your account…
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: C.textMuted, margin: "0 0 22px" }}>
          The connection is being slow. Your account is safe — give it another
          try in a moment.
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
            fontSize: 18,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Trying…" : "Try again"}
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
