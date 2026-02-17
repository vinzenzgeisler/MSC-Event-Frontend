import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";

const ROLE_PRIORITY = ["admin", "checkin", "viewer"] as const;

type GuardProps = {
  allowedRoles?: string[];
};

export function ProtectedRoute({ allowedRoles }: GuardProps) {
  const location = useLocation();
  const { isAuthenticated, roles } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles || allowedRoles.length === 0) {
    return <Outlet />;
  }

  const effectiveRoles = roles.filter((role) => ROLE_PRIORITY.includes(role as (typeof ROLE_PRIORITY)[number]));
  const allowed = effectiveRoles.some((role) => allowedRoles.includes(role));

  if (!allowed) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return <Outlet />;
}
