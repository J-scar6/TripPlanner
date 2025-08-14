import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TripPlannerApp from "./TripPlannerApp.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TripPlannerApp />
  </StrictMode>
);
