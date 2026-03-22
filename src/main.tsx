import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import "./index.css";

if (window.location.pathname.startsWith("/admin")) {
  void navigator.serviceWorker.register("/sw.js", { scope: "/admin/" }).catch(() => {
    // Ignore failed SW registration outside supported environments.
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>
);
