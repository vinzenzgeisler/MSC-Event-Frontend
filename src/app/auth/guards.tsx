import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { getEffectiveRoles } from "@/app/auth/iam";

type GuardProps = {
  allowedRoles?: string[];
  children?: ReactNode;
};

export function ProtectedRoute({ allowedRoles, children }: GuardProps) {
  const location = useLocation();
  const { isAuthenticated, roles } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles || allowedRoles.length === 0) {
    return <Outlet />;
  }

  const effectiveRoles = getEffectiveRoles(roles);
  const allowed = effectiveRoles.some((role) => allowedRoles.includes(role));

  if (!allowed) {
    return <Navigate to="/admin/forbidden" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
