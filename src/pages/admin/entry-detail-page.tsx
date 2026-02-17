import { useParams } from "react-router-dom";
import { EmptyState } from "@/components/state/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminEntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nennungsdetail: {entryId}</CardTitle>
        <CardDescription>Detailfunktionen werden nach Backend-Vertragserweiterung aktiviert.</CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState message="Backend-Lücke: Es fehlt ein dokumentierter Read-Endpoint für eine einzelne Entry-Detailansicht." />
      </CardContent>
    </Card>
  );
}
