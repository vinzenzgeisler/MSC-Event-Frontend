import { EmptyState } from "@/components/state/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminMailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kommunikation</CardTitle>
        <CardDescription>
          Queue-Endpunkte sind vorhanden, Outbox/Retry fehlen aktuell im dokumentierten Vertrag.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState message="Backend-Lücke: Outbox Monitoring (queued/sent/failed) und Retry-Endpoint nicht in OpenAPI." />
      </CardContent>
    </Card>
  );
}
