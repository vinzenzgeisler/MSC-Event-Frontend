import { useNavigate, useParams } from "react-router-dom";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { getLegalTexts } from "@/config/legal-texts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ParsedParagraph = {
  key: string;
  label: string;
  body: string;
};

function getSectionLabel(locale: string) {
  if (locale === "en") {
    return "Section";
  }
  if (locale === "cz") {
    return "Oddil";
  }
  if (locale === "pl") {
    return "Sekcja";
  }
  return "Abschnitt";
}

function parseParagraph(paragraph: string, index: number, locale: string): ParsedParagraph {
  const normalized = paragraph.trim();
  const withColon = normalized.match(/^(\d+)\.\s*([^:]+):\s*(.+)$/);
  if (withColon) {
    return {
      key: `${index}-${withColon[1]}`,
      label: `${getSectionLabel(locale)} ${withColon[1]} - ${withColon[2].trim()}`,
      body: withColon[3].trim()
    };
  }

  const numbered = normalized.match(/^(\d+)\.\s*(.+)$/);
  if (numbered) {
    return {
      key: `${index}-${numbered[1]}`,
      label: `${getSectionLabel(locale)} ${numbered[1]}`,
      body: numbered[2].trim()
    };
  }

  return {
    key: `${index}`,
    label: `${getSectionLabel(locale)} ${index + 1}`,
    body: normalized
  };
}

export function LegalPlaceholderPage() {
  const { locale } = useAnmeldungI18n();
  const legalTexts = getLegalTexts(locale);
  const backLabel =
    locale === "en" ? "Back to registration" : locale === "cz" ? "Zpet k registraci" : locale === "pl" ? "Powrot do rejestracji" : "Zurück zur Anmeldung";
  const navigate = useNavigate();
  const { docId = "" } = useParams();

  const docs = {
    impressum: legalTexts.imprintDoc,
    datenschutz: legalTexts.privacyDoc,
    haftung: legalTexts.waiverDoc,
    haftverzicht: legalTexts.waiverDoc,
    teilnahmebedingungen: legalTexts.termsDoc,
    agb: legalTexts.termsDoc
  } as const;

  const doc = docs[(docId as keyof typeof docs) ?? "datenschutz"] ?? docs.datenschutz;
  const parsed = doc.paragraphs.map((paragraph, index) => parseParagraph(paragraph, index, locale));
  const isImprintDoc = docId === "impressum";

  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>{doc.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-700">
        {isImprintDoc ? (
          <div className="space-y-1 text-base leading-7 text-slate-800">
            {doc.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : (
          parsed.map((entry) => (
            <section key={entry.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{entry.label}</p>
              <p className="mt-1 leading-6 text-slate-800">{entry.body}</p>
            </section>
          ))
        )}

        <button
          type="button"
          className="inline-flex text-sm font-medium text-primary hover:underline"
          onClick={() => {
            navigate("/anmeldung");
          }}
        >
          {backLabel}
        </button>
      </CardContent>
    </Card>
  );
}
