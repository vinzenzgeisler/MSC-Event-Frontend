import { Outlet } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { AdminNav } from "@/components/navigation/admin-nav";
import { Button } from "@/components/ui/button";

export function AdminLayout() {
  const { logout, roles } = useAuth();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">MSC Event</div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">Rollen: {roles.length ? roles.join(", ") : "unbekannt"}</p>
        </div>
        <Button variant="outline" onClick={logout}>
          Logout
        </Button>
      </header>
      <div className="mb-6">
        <AdminNav />
      </div>
      <Outlet />
    </div>
  );
}
