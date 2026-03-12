import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { DocumentMeta } from "@/app/document-meta";
import { AdminNav } from "@/components/navigation/admin-nav";
import { Button } from "@/components/ui/button";

function looksLikeOpaqueId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) || /^[0-9a-f]{32,}$/i.test(value);
}

export function AdminLayout() {
  const { logout, roles, displayName, email } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const showDisplayName = Boolean(displayName && !looksLikeOpaqueId(displayName));

  return (
    <div className="min-h-screen bg-slate-100">
      <DocumentMeta />
      <div className="border-b bg-white lg:hidden">
        <div className="flex w-full items-center justify-between px-4 py-3">
          <div className="text-base font-semibold text-slate-900">MSC Event Verwaltung</div>
          <Button type="button" size="sm" variant="outline" onClick={() => setMenuOpen((prev) => !prev)}>
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          aria-label="Navigation schließen"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="mx-auto grid w-full max-w-[1500px] items-start gap-4 px-3 py-4 md:px-4 md:py-6 lg:grid-cols-[240px_1fr] lg:gap-6 xl:px-5 2xl:px-6">
        <aside
          className={[
            "rounded-lg border bg-white p-4",
            "fixed inset-y-0 left-0 z-40 w-[86%] max-w-xs overflow-y-auto transition lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-auto lg:max-w-none",
            menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          ].join(" ")}
        >
          <div className="mb-4 border-b pb-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin-Bereich</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">MSC Event</div>
            <div className="mt-3 space-y-1 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <div className="font-medium text-slate-800">{showDisplayName ? displayName : email || "Angemeldet"}</div>
              {email && showDisplayName && <div>{email}</div>}
              <div>Rollen: {roles.length > 0 ? roles.join(", ") : "nicht im Token"}</div>
            </div>
          </div>
          <div onClick={() => setMenuOpen(false)}>
            <AdminNav />
          </div>
          <div className="mt-6 border-t pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
            >
              Logout
            </Button>
          </div>
        </aside>
        <main className="min-w-0 space-y-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
