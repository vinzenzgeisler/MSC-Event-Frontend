import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LocationState = {
  from?: {
    pathname?: string;
  };
};

export function AdminLoginPage() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LocationState | null)?.from?.pathname || "/admin/entries";

  return (
    <div className="mx-auto mt-20 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Admin Login (Token Bootstrap)</CardTitle>
          <CardDescription>
            Temporärer Login per Bearer Token, bis Cognito Hosted UI integriert ist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Bearer Token</Label>
            <Input id="token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="eyJ..." />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (!token.trim()) {
                return;
              }
              login(token.trim());
              navigate(redirectTo, { replace: true });
            }}
          >
            Einloggen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
