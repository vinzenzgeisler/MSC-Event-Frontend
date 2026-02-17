import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "@/app/auth/guards";
import { AdminLayout } from "@/app/layouts/admin-layout";
import { PublicLayout } from "@/app/layouts/public-layout";
import { AnmeldungPage } from "@/pages/anmeldung-page";
import { HomePage } from "@/pages/home-page";
import { AdminEntriesPage } from "@/pages/admin/entries-page";
import { AdminEntryDetailPage } from "@/pages/admin/entry-detail-page";
import { AdminExportsPage } from "@/pages/admin/exports-page";
import { ForbiddenPage } from "@/pages/admin/forbidden-page";
import { AdminLoginPage } from "@/pages/admin/login-page";
import { AdminMailPage } from "@/pages/admin/mail-page";

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
          { path: "entries", element: <AdminEntriesPage /> },
          { path: "entries/:entryId", element: <AdminEntryDetailPage /> },
          { path: "mail", element: <AdminMailPage /> },
          { path: "exports", element: <AdminExportsPage /> }
        ]
      }
    ]
  },
  {
    path: "/admin/forbidden",
    element: <ForbiddenPage />
  }
]);
