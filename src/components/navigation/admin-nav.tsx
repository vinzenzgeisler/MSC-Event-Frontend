import { NavLink } from "react-router-dom";
import { LayoutGrid, ListChecks, Mail, FileDown, Settings } from "lucide-react";
import { useAuth } from "@/app/auth/auth-context";
import { hasPermission, type AppPermission } from "@/app/auth/iam";
import { cn } from "@/lib/utils";

const links = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid, permission: "dashboard.read" as AppPermission },
  { to: "/admin/entries", label: "Nennungen", icon: ListChecks, permission: "entries.read" as AppPermission },
  { to: "/admin/communication", label: "Kommunikation", icon: Mail, permission: "communication.read" as AppPermission },
  { to: "/admin/exports", label: "Exporte", icon: FileDown, permission: "exports.read" as AppPermission },
  { to: "/admin/settings", label: "Einstellungen", icon: Settings, permission: "settings.read" as AppPermission }
];

export function AdminNav() {
  const { roles } = useAuth();

  return (
    <nav className="grid gap-1">
      {links.filter((link) => hasPermission(roles, link.permission)).map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition",
                isActive ? "bg-primary text-primary-foreground" : "text-slate-700 hover:bg-slate-100"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
