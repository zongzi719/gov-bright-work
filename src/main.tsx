// ============================================================
// CRITICAL: Polyfills must be at the ABSOLUTE TOP before any imports
// This ensures they are available before React or any library code runs
// ============================================================

// ResizeObserver polyfill for older browsers (Kylin V10 Firefox 62)
// This must run before React components that use ResizeObserver
import ResizeObserverPolyfill from "resize-observer-polyfill";
if (typeof window !== "undefined" && !window.ResizeObserver) {
  (window as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver = ResizeObserverPolyfill;
}

// ============================================================
// Now safe to import React and application code
// ============================================================

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure the root element exists before rendering
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("[main.tsx] Root element not found!");
}
