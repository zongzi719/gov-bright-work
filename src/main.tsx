// ResizeObserver polyfill for older browsers (Kylin V10 Firefox 62)
import ResizeObserverPolyfill from "resize-observer-polyfill";
if (typeof window !== "undefined" && !window.ResizeObserver) {
  (window as any).ResizeObserver = ResizeObserverPolyfill;
}

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);