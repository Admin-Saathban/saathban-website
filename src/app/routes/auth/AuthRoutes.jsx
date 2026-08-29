/* ════════════════════════════════════════════════
   /app/auth/* — the auth lane's route table (build steps 3–5).

   Mounted by AppRoot at path "auth/*". Everything auth-related lives
   under here; AppRoot needs only the one mount line.
   ════════════════════════════════════════════════ */

import { Navigate, Route, Routes } from "react-router-dom";
import RoleSelect from "./RoleSelect.jsx";
import SignupIcon from "./SignupIcon.jsx";
import SignupFam from "./SignupFam.jsx";
import SignupBuddy from "./SignupBuddy.jsx";
import Login from "./Login.jsx";
import CheckEmail from "./CheckEmail.jsx";
import Complete from "./Complete.jsx";
import ResetPassword from "./ResetPassword.jsx";
import Welcome from "./Welcome.jsx";

export default function AuthRoutes() {
  return (
    <Routes>
      <Route index element={<RoleSelect />} />
      <Route path="signup/icon" element={<SignupIcon />} />
      <Route path="signup/fam" element={<SignupFam />} />
      <Route path="signup/buddy" element={<SignupBuddy />} />
      <Route path="login" element={<Login />} />
      <Route path="check-email" element={<CheckEmail />} />
      <Route path="complete" element={<Complete />} />
      <Route path="reset" element={<ResetPassword />} />
      {/* After-login landing for Saath-Fam and Saath-Buddy until their
          dashboards land — see roleHomePath() in lib/session.jsx. */}
      <Route path="welcome" element={<Welcome />} />
      <Route path="*" element={<Navigate to="/app/auth" replace />} />
    </Routes>
  );
}
