import { lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    element: <PublicLayout />,
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
