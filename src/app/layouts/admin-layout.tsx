import { Outlet } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { AdminNav } from "@/components/navigation/admin-nav";
import { Button } from "@/components/ui/button";

export function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-lg border bg-white p-4">
          <div className="mb-4 border-b pb-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin-Bereich</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">MSC Event</div>
          </div>
          <AdminNav />
          <div className="mt-6 border-t pt-4">
            <Button size="sm" variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        </aside>
        <main className="space-y-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
