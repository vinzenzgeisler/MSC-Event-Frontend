import { Link } from "react-router-dom";
import { EmptyState } from "@/components/state/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminEntriesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nennungen</CardTitle>
        <CardDescription>
          Liste wird nach OpenAPI-Update mit Response-Schema und Pagination-Meta vollständig umgesetzt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EmptyState message="Backend-Lücke: GET /admin/entries liefert aktuell kein dokumentiertes Response-Schema." />
        <Link className="text-sm text-primary underline" to="/admin/entries/example-id">
          Zur Detailseite (Platzhalter)
        </Link>
      </CardContent>
    </Card>
  );
}
