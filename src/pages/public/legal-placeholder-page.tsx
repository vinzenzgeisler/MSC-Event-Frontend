import { useNavigate, useParams } from "react-router-dom";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { usePublicLegal } from "@/app/legal/public-legal-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LegalPlaceholderPage() {
  const { texts: legalTexts, loading } = usePublicLegal();
  const navigate = useNavigate();
  const { docId = "" } = useParams();
  const normalizedDocId = docId === "haftung" ? "haftverzicht" : docId === "agb" ? "teilnahmebedingungen" : docId;
  const doc = normalizedDocId && legalTexts?.docs ? legalTexts.docs[normalizedDocId as keyof typeof legalTexts.docs] ?? legalTexts.docs.datenschutz : null;

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-2 border-b border-slate-100 pb-5">
        <CardTitle className="text-balance text-2xl text-slate-950">{doc?.title ?? ""}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5 md:p-6">
        {loading ? <p className="text-sm text-slate-600">Lade Rechtstexte…</p> : null}
        <div className="space-y-6 text-sm leading-7 text-slate-700 md:text-[15px]">
          {doc?.intro?.length ? (
            <div className="space-y-3">
              {doc.intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          {doc?.sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="pt-1 text-lg font-semibold text-slate-950 md:text-xl">{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul className="list-disc space-y-2 pl-5 marker:text-slate-400">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate("/anmeldung")}>
            {legalTexts?.legalPageBackLabel ?? "Zurück zur Anmeldung"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
