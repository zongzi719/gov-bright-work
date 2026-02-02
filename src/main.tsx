import React from "react";
import { createRoot } from "react-dom/client";
import ResizeObserver from "resize-observer-polyfill";
import App from "./App.tsx";
import "./index.css";

// Polyfill for older browsers (Kylin V10 Firefox 62)
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserver;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);