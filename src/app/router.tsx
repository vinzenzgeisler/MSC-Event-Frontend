import { lazy } from "react";
import { createBrowserRouter, isRouteErrorResponse, Navigate, useRouteError } from "react-router-dom";
import { ProtectedRoute } from "@/app/auth/guards";
import { AdminLayout } from "@/app/layouts/admin-layout";
import { PublicLayout } from "@/app/layouts/public-layout";
import { HomePage } from "@/pages/home-page";

const AnmeldungPage = lazy(() =>
  import("@/pages/public/anmeldung-page").then((module) => ({
    default: module.AnmeldungPage,
  })),
);
const AnmeldungVerifyPage = lazy(() =>
  import("@/pages/public/anmeldung-verify-page").then((module) => ({
    default: module.AnmeldungVerifyPage,
  })),
);
const LegalPlaceholderPage = lazy(() =>
  import("@/pages/public/legal-placeholder-page").then((module) => ({
    default: module.LegalPlaceholderPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import("@/pages/admin/dashboard-page").then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const AdminEntriesPage = lazy(() =>
  import("@/pages/admin/entries-page").then((module) => ({
    default: module.AdminEntriesPage,
  })),
);
const AdminEntryDetailPage = lazy(() =>
  import("@/pages/admin/entry-detail-page").then((module) => ({
    default: module.AdminEntryDetailPage,
  })),
);
const AdminExportsPage = lazy(() =>
  import("@/pages/admin/exports-page").then((module) => ({
    default: module.AdminExportsPage,
  })),
);
const ForbiddenPage = lazy(() =>
  import("@/pages/admin/forbidden-page").then((module) => ({
    default: module.ForbiddenPage,
  })),
);
const AdminLoginPage = lazy(() =>
  import("@/pages/admin/login-page").then((module) => ({
    default: module.AdminLoginPage,
  })),
);
const AdminCommunicationPage = lazy(() =>
  import("@/pages/admin/communication-page").then((module) => ({
    default: module.AdminCommunicationPage,
  })),
);
const AdminSettingsPage = lazy(() =>
  import("@/pages/admin/settings-page").then((module) => ({
    default: module.AdminSettingsPage,
  })),
);
const AdminMailDesignLabPage = lazy(() =>
  import("@/pages/admin/mail-design-lab-page").then((module) => ({
    default: module.AdminMailDesignLabPage,
  })),
);
const AdminTechnicalInspectionPage = lazy(() =>
  import("@/pages/admin/technical-inspection-page").then((module) => ({
    default: module.AdminTechnicalInspectionPage,
  })),
);

function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unbekannter Fehler";

  return (
    <main className="min-h-dvh bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-2xl rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Fehler</p>
        <h1 className="mt-2 text-2xl font-semibold">Diese Ansicht konnte nicht geladen werden.</h1>
        <p className="mt-3 text-sm text-slate-600">
          Bitte lade die Seite neu. Wenn der Fehler erneut auftritt, prüfe die API-Verbindung oder melde die Aktion an den Support.
        </p>
        <p className="mt-4 rounded-md bg-slate-100 p-3 text-xs text-slate-600">{message}</p>
        <button
          type="button"
          className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          onClick={() => window.location.reload()}
        >
          Seite neu laden
        </button>
      </section>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "/anmeldung",
        element: <AnmeldungPage />,
      },
      {
        path: "/anmeldung/verify",
        element: <AnmeldungVerifyPage />,
      },
      {
        path: "/anmeldung/rechtliches/:docId",
        element: <LegalPlaceholderPage />,
      },
    ],
  },
  {
    path: "/admin/login",
    element: <AdminLoginPage />,
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="entries" replace /> },
          { path: "dashboard", element: <AdminDashboardPage /> },
          { path: "entries", element: <AdminEntriesPage /> },
          { path: "entries/:entryId", element: <AdminEntryDetailPage /> },
          {
            path: "communication",
            element: (
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminCommunicationPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "communication/design-lab",
            element: (
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminMailDesignLabPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "exports",
            element: (
              <ProtectedRoute allowedRoles={["admin", "editor", "viewer"]}>
                <AdminExportsPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "settings",
            element: (
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminSettingsPage />
              </ProtectedRoute>
            ),
          },
        ],
      },
      {
        path: "/inspection",
        element: (
          <ProtectedRoute allowedRoles={["admin", "technical_inspector"]}>
            <AdminTechnicalInspectionPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/inspection/:entryId",
        element: (
          <ProtectedRoute allowedRoles={["admin", "technical_inspector"]}>
            <AdminTechnicalInspectionPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: "/admin/forbidden",
    element: <ForbiddenPage />,
  },
]);
