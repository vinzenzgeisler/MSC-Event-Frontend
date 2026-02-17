import { EmptyState } from "@/components/state/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminExportsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exporte</CardTitle>
        <CardDescription>
          Export-Flows werden nach dokumentierten Success-Responses für Jobliste und Detailstatus vervollständigt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState message="Backend-Lücke: GET /admin/exports und GET /admin/exports/{id} ohne dokumentiertes Response-Schema." />
      </CardContent>
    </Card>
  );
}
