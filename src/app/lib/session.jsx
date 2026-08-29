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
import { COLORS as C } from "../../shared/tokens.js";
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
  const [profile, setProfile] = useState(undefined);
  // Skip profile refetches on token refreshes for the same person.
  const profileUserRef = useRef(null);

  const loadProfile = useCallback(async (sess, { force = false } = {}) => {
    if (!sess) {
      profileUserRef.current = null;
      setProfile(null);
      return;
    }
    if (!force && profileUserRef.current === sess.user.id) return;
    profileUserRef.current = sess.user.id;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (error) throw error;
      setProfile(data ?? null);
    } catch {
      // Fetch failure is treated as "no profile yet": the finish flow
      // it leads to tolerates an existing row (23505 → success), so a
      // flaky network can never lock anyone out or duplicate anything.
      setProfile(null);
    }
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
      profile: profile ?? null,
      loading: session === undefined || (Boolean(session) && profile === undefined),
      refreshProfile,
    }),
    [session, profile, refreshProfile]
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

export function RequireAuth({ roles, children }) {
  const { session, profile, loading } = useSession();
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
  if (!profile) return <Navigate to="/app/auth?finish=1" replace />;
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to={roleHomePath(profile.role)} replace />;
  }
  return children;
}
