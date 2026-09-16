import React from "react";
import ReactDOM from "react-dom/client";
import App, { ErrorBoundary } from "./App.jsx";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa.jsx";

// Register Service Worker for offline capability
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);