import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/app/auth/auth-store";
import { extractRoles } from "@/app/auth/jwt";

type AuthContextValue = {
  token: string | null;
  roles: string[];
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => getAuthToken());

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      roles: token ? extractRoles(token) : [],
      isAuthenticated: Boolean(token),
      login: (nextToken: string) => {
        setAuthToken(nextToken);
        setToken(nextToken);
      },
      logout: () => {
        clearAuthToken();
        setToken(null);
      }
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
