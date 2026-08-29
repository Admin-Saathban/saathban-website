/* Entry for preview.html — mounts the vetting flow standalone.
   Dev-only; not part of any production entry graph. */

import React from "react";
import ReactDOM from "react-dom/client";
import VettingForm from "./VettingForm.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <VettingForm />
  </React.StrictMode>
);
