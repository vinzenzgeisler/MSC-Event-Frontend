import { DocumentMeta } from "@/app/document-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ForbiddenPage() {
  return (
    <>
      <DocumentMeta />
      <Card>
        <CardHeader>
          <CardTitle>Kein Zugriff</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Deine Rolle erlaubt keinen Zugriff auf diese Seite.</p>
        </CardContent>
      </Card>
    </>
  );
}
