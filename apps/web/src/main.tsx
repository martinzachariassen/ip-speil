import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { applyTheme, initialTheme } from "./hooks/useTheme.ts";
import "./index.css";

// Resolve and apply the theme before the first paint so there's no flash of the
// wrong palette. useTheme() reads the attribute back for its initial state.
applyTheme(initialTheme());

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
