import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Register the minimal service worker that enables OS-level browser notifications
// in Chrome when the tab is backgrounded or the window is minimised.
if ("serviceWorker" in navigator) {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  navigator.serviceWorker.register(swUrl).catch((err) => {
    console.warn("[AdminAlerts] SW registration failed:", err);
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
