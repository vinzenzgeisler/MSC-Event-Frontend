import { type PropsWithChildren } from "react";
import { AuthProvider } from "@/app/auth/auth-context";
import { DemoModeBanner } from "@/demo/banner";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <DemoModeBanner />
      {children}
    </AuthProvider>
  );
}
