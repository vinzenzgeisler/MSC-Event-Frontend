import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import "./index.css";

function installZoomGuards() {
  const preventDefault = (event: Event) => {
    event.preventDefault();
  };

  document.addEventListener("gesturestart", preventDefault, { passive: false });
  document.addEventListener("gesturechange", preventDefault, {
    passive: false,
  });
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false },
  );
}

installZoomGuards();

const pwaScope = window.location.pathname.startsWith("/inspection")
  ? "/inspection"
  : window.location.pathname.startsWith("/admin")
    ? "/admin/"
    : null;

if (pwaScope && "serviceWorker" in navigator) {
  const hadServiceWorkerController = Boolean(
    navigator.serviceWorker.controller,
  );
  let reloadPending = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadServiceWorkerController && !reloadPending) {
      reloadPending = true;
      window.location.reload();
    }
  });

  void navigator.serviceWorker
    .register("/sw.js", { scope: pwaScope })
    .then((registration) => registration.update())
    .catch(() => {
      // Ignore failed SW registration outside supported environments.
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <Suspense fallback={null}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  </React.StrictMode>,
);
