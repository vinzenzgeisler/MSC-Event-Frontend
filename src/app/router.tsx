import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/app/auth/guards";
import { AdminLayout } from "@/app/layouts/admin-layout";
import { PublicLayout } from "@/app/layouts/public-layout";
import { HomePage } from "@/pages/home-page";
import { AnmeldungPage } from "@/pages/public/anmeldung-page";
import { AdminDashboardPage } from "@/pages/admin/dashboard-page";
import { AdminEntriesPage } from "@/pages/admin/entries-page";
import { AdminEntryDetailPage } from "@/pages/admin/entry-detail-page";
import { AdminExportsPage } from "@/pages/admin/exports-page";
import { ForbiddenPage } from "@/pages/admin/forbidden-page";
import { AdminLoginPage } from "@/pages/admin/login-page";
import { AdminCommunicationPage } from "@/pages/admin/communication-page";
import { AdminSettingsPage } from "@/pages/admin/settings-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />
  },
  {
    element: <PublicLayout />,
    children: [
      {
        path: "/anmeldung",
        element: <AnmeldungPage />
      }
    ]
  },
  {
    path: "/admin/login",
    element: <AdminLoginPage />
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <AdminDashboardPage /> },
          { path: "entries", element: <AdminEntriesPage /> },
          { path: "entries/:entryId", element: <AdminEntryDetailPage /> },
          { path: "communication", element: <AdminCommunicationPage /> },
          { path: "exports", element: <AdminExportsPage /> },
          { path: "settings", element: <AdminSettingsPage /> }
        ]
      }
    ]
  },
  {
    path: "/admin/forbidden",
    element: <ForbiddenPage />
  }
]);
