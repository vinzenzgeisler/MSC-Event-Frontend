import { useNavigate, useParams } from "react-router-dom";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LegalPlaceholderPage() {
  const { m } = useAnmeldungI18n();
  const navigate = useNavigate();
  const { docId = "" } = useParams();
  const docs = {
    impressum: m.legal.impressum,
    datenschutz: m.legal.datenschutz,
    haftung: m.legal.haftung
  } as const;
  const doc = docs[(docId as keyof typeof docs) ?? "datenschutz"] ?? docs.datenschutz;

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{doc.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-700">
        <p>{doc.intro}</p>
        <ul className="list-disc space-y-1 pl-5">
          {doc.points.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">{m.legal.note}</p>
        <button
          type="button"
          className="inline-flex text-sm font-medium text-primary hover:underline"
          onClick={() => {
            window.close();
            setTimeout(() => {
              if (window.history.length > 1) {
                navigate(-1);
                return;
              }
              navigate("/anmeldung");
            }, 120);
          }}
        >
          {m.legal.back}
        </button>
      </CardContent>
    </Card>
  );
}
