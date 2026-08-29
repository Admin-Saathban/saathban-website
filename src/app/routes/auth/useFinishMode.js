/* Shared by the three signup forms.

   Finish mode (?finish=1): a session already exists but has no profile
   row — assisted signup at an event, or a sign-in link that carried no
   signup details. The form then skips the credential step and creates
   the profile directly. If there is no session after all, fall back to
   the normal role-selection entrance. */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import supabase from "../../lib/supabase.js";

export default function useFinishMode() {
  const [params] = useSearchParams();
  const finish = params.get("finish") === "1";
  const navigate = useNavigate();
  const [sessionEmail, setSessionEmail] = useState(null);

  useEffect(() => {
    if (!finish) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) navigate("/app/auth", { replace: true });
      else setSessionEmail(data.session.user.email || "");
    });
    return () => {
      alive = false;
    };
  }, [finish, navigate]);

  return { finish, sessionEmail };
}
