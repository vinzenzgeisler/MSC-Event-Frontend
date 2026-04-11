export type LegalUiLocale = "de" | "en" | "cz" | "pl";
export type ConsentLocale = "de-DE" | "en-GB" | "cs-CZ" | "pl-PL";
export type LegalDocId = "impressum" | "datenschutz" | "teilnahmebedingungen" | "haftverzicht";

export type LegalDocSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDoc = {
  id: LegalDocId;
  title: string;
  summaryLinkLabel: string;
  intro?: string[];
  sections: LegalDocSection[];
};

export type SummaryTexts = {
  title: string;
  mandatoryHintsTitle: string;
  mandatoryHints: string[];
  introTitle: string;
  introBody: string[];
  voluntaryTitle: string;
  voluntaryBody: string;
  waiverNoticeTitle: string;
  waiverNoticeBody: string;
  linksTitle: string;
  requiredTitle: string;
  optionalTitle: string;
  termsAcceptanceLabel: string;
  privacyAcceptanceLabel: string;
  waiverAcceptanceLabel: string;
  mediaAcceptanceLabel: string;
  clubInfoAcceptanceLabel: string;
  minorNotice: string;
};

export type LegalTexts = {
  footerPrivacyLabel: string;
  footerImprintLabel: string;
  footerTermsLabel: string;
  footerWaiverLabel: string;
  guardianSectionTitle: string;
  guardianFullNameLabel: string;
  guardianEmailLabel: string;
  guardianPhoneLabel: string;
  guardianConsentLabel: string;
  legalPageBackLabel: string;
  summary: SummaryTexts;
  docs: Record<LegalDocId, LegalDoc>;
};

export function mapUiLocaleToConsentLocale(locale: string): ConsentLocale {
  if (locale === "en") {
    return "en-GB";
  }
  if (locale === "cz") {
    return "cs-CZ";
  }
  if (locale === "pl") {
    return "pl-PL";
  }
  return "de-DE";
}
