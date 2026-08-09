import { ThemeProvider } from "@martinzachariassen/design";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { applyStoredTheme, THEME_STORAGE_KEY } from "./lib/theme.ts";
import "./index.css";

// Before the first paint, so there's no flash of the wrong palette. ThemeProvider
// reads the same key on mount and takes it from there.
applyStoredTheme();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ThemeProvider attribute="data-theme" storageKey={THEME_STORAGE_KEY}>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}
