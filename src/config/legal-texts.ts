export type LegalUiLocale = "de" | "en" | "cz" | "pl";
export type ConsentLocale = "de-DE" | "en-GB" | "cs-CZ" | "pl-PL";

export const CONSENT_VERSION = "privacy-v1.0+terms-v1.0+media-v1.0";

type LegalDoc = {
  title: string;
  paragraphs: string[];
};

type LegalTexts = {
  shortInfo: string;
  waiverSignNotice: string;
  footerPrivacyLabel: string;
  footerImprintLabel: string;
  footerTermsLabel: string;
  footerWaiverLabel: string;
  termsAcceptanceLabel: string;
  privacyAcceptanceLabel: string;
  mediaAcceptanceLabel: string;
  minorNotice: string;
  guardianSectionTitle: string;
  guardianFullNameLabel: string;
  guardianEmailLabel: string;
  guardianPhoneLabel: string;
  guardianConsentLabel: string;
  imprintDoc: LegalDoc;
  privacyDoc: LegalDoc;
  termsDoc: LegalDoc;
  waiverDoc: LegalDoc;
};

type PersistedLegalTextsLocale = LegalUiLocale;

const LEGAL_TEXTS: Record<PersistedLegalTextsLocale, LegalTexts> = {
  de: {
    shortInfo:
      "Mit Absenden der Anmeldung verarbeiten wir Ihre personenbezogenen Daten zur Anmeldung, Teilnehmerverwaltung, Kommunikation, Dokumentenerstellung und Abrechnung. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO sowie bei gesetzlichen Pflichten Art. 6 Abs. 1 lit. c DSGVO. Optionale Medienverarbeitung erfolgt nur mit Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO. Empfaenger sind intern zustaendige Stellen sowie technische Auftragsverarbeiter in AWS eu-central-1. Ihre Rechte auf Auskunft, Berichtigung, Loeschung, Einschraenkung, Widerspruch und Datenuebertragbarkeit bleiben unberuehrt.",
    waiverSignNotice: "Die verbindliche Haftverzichtserklaerung wird vor Ort bei der Anmeldung in Schriftform unterschrieben.",
    footerPrivacyLabel: "Datenschutz",
    footerImprintLabel: "Impressum",
    footerTermsLabel: "Teilnahmebedingungen",
    footerWaiverLabel: "Haftverzicht",
    termsAcceptanceLabel: "Ich akzeptiere die Teilnahmebedingungen.",
    privacyAcceptanceLabel: "Ich habe die Datenschutzhinweise gelesen und akzeptiere die Datenverarbeitung zur Veranstaltungsabwicklung.",
    mediaAcceptanceLabel:
      "Ich willige in die Nutzung von Foto-/Videomaterial fuer Veranstaltungsbericht, Vereinswebsite und Vereins-Social-Media-Kanaele ein.",
    minorNotice: "Minderjaehrige koennen nur mit ausdruecklicher Zustimmung eines Sorgeberechtigten angemeldet werden.",
    guardianSectionTitle: "Angaben Sorgeberechtigter (bei Fahrern unter 18)",
    guardianFullNameLabel: "Vollstaendiger Name Sorgeberechtigter",
    guardianEmailLabel: "E-Mail Sorgeberechtigter",
    guardianPhoneLabel: "Telefon Sorgeberechtigter",
    guardianConsentLabel: "Ich bestaetige als Sorgeberechtigter die Teilnahme des minderjaehrigen Fahrers.",
    imprintDoc: {
      title: "Impressum",
      paragraphs: [
        "Angaben gemaess § 5 DDG: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz.",
        "Vertretungsberechtigung: Vertreten durch den 1. Vorsitzenden Herrn Peter Liersch.",
        "Kontakt: E-Mail info@msc-oberlausitzer-dreilaendereck.eu.",
        "Registereintrag: Registergericht Dresden, Vereinsregister VR 5907.",
        "Umsatzsteuer: USt-IdNr. DE289954270.",
        "Verantwortlich fuer Inhalte: MSC Oberlausitzer Dreilaendereck e.V."
      ]
    },
    privacyDoc: {
      title: "Datenschutzhinweise",
      paragraphs: [
        "1. Verantwortlicher: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz, E-Mail info@msc-oberlausitzer-dreilaendereck.eu.",
        "2. Datenschutzbeauftragter: Stephan Jakab, Kontakt ueber info@msc-oberlausitzer-dreilaendereck.eu.",
        "3. Zweck und Rechtsgrundlagen: Entgegennahme/Bearbeitung der Anmeldung, Teilnehmerverwaltung, Veranstaltungsdurchfuehrung inkl. Check-in/technische Abnahme, Kommunikation, Dokumentenerstellung und Abrechnung. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b, lit. c, lit. f DSGVO; optionale Medienverarbeitung nur nach Art. 6 Abs. 1 lit. a DSGVO. Ergaenzend gelten die einschlaegigen Vorschriften des BDSG.",
        "4. Datenkategorien: Identifikations- und Kontaktdaten, Teilnehmer- und Fahrzeugdaten, Notfallkontaktdaten, Status-/Prozessdaten sowie Consent-Nachweise (Version, Zeitstempel, Hash, Locale, Quelle).",
        "5. Empfaenger/Auftragsverarbeiter: Intern zustaendige Vereins-/Orga-Stellen sowie AWS als Auftragsverarbeiter (RDS, S3, SES, Cognito, CloudWatch, Lambda, EventBridge, API Gateway, Secrets Manager), Region eu-central-1. Eine Weitergabe an sonstige Dritte erfolgt nur bei rechtlicher Verpflichtung oder ausdruecklicher Einwilligung.",
        "6. Speicherdauer und Loeschung: Operative Anmeldedaten in der Regel 3 Jahre nach Veranstaltungsende; Kommunikations-/Outboxdaten 12 Monate; Exportdaten 90 Tage; Verifikations-/Idempotenzdaten 30 Tage; Auditdaten 24 Monate; Rechnungs-/Zahlungsdaten 10 Jahre soweit gesetzlich erforderlich. Nach Zweckwegfall bzw. Fristablauf werden Daten geloescht oder gesperrt.",
        "7. Betroffenenrechte: Auskunft, Berichtigung, Loeschung, Einschraenkung, Widerspruch und Datenuebertragbarkeit sowie Widerruf erteilter Einwilligungen mit Wirkung fuer die Zukunft.",
        "8. Beschwerderecht: Beschwerde bei einer Datenschutzaufsichtsbehoerde (z. B. BfDI oder landeszustaendige Aufsicht) ist moeglich.",
        "9. Technische Sicherheit: Die Uebertragung erfolgt verschluesselt via TLS/HTTPS. Absolute Sicherheit der Datenuebertragung im Internet kann dennoch nicht garantiert werden.",
        "10. Technische Protokolle und notwendige Speichermechanismen: Beim Aufruf der Anwendung fallen technisch notwendige Verbindungs- und Serverprotokolle an. Es werden keine Marketing- oder Analytics-Cookies aktiviert. Fuer die Funktion des Formulars koennen technisch notwendige Browser-Speicher verwendet werden (z. B. Spracheinstellung und Formularentwuerfe).",
        "11. Datensicherheit: Zugriff auf personenbezogene Daten erfolgt nach dem Need-to-know-Prinzip; technische und organisatorische Massnahmen (u. a. Zugriffsrechte, Protokollierung, Aktualisierung der Systeme) werden umgesetzt.",
        "12. Pflicht zur Bereitstellung: Ohne die als erforderlich gekennzeichneten Angaben ist eine Teilnahmeabwicklung nicht moeglich.",
        "13. Kontaktanfragen: Bei Kontaktaufnahme per E-Mail oder Kontaktformular (Vereinswebsite) werden die Angaben zur Bearbeitung der Anfrage und fuer Anschlussfragen verarbeitet.",
        "14. Aktualisierung: Diese Datenschutzhinweise koennen angepasst werden, wenn sich rechtliche oder organisatorische Anforderungen aendern."
      ]
    },
    termsDoc: {
      title: "Teilnahmebedingungen / AGB und Einwilligungen",
      paragraphs: [
        "1. Teilnahmevoraussetzung Minderjaehrige: Minderjaehrige Teilnehmer koennen angemeldet werden, wenn ein Sorgeberechtigter der Anmeldung ausdruecklich zustimmt. Bei minderjaehrigen Teilnehmern sind Name, E-Mail, Telefon und bestaetigende Zustimmung des Sorgeberechtigten verpflichtend anzugeben.",
        "2. Medien-Einwilligung (optional): Foto- und/oder Videoaufnahmen duerfen fuer Veranstaltungsbericht, Vereinswebsite und vereinseigene Social-Media-Kanaele genutzt werden.",
        "3. Widerruf Medien-Einwilligung: Die Einwilligung ist freiwillig und jederzeit mit Wirkung fuer die Zukunft per E-Mail an info@msc-oberlausitzer-dreilaendereck.eu widerrufbar. Die Rechtmaessigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt unberuehrt.",
        "4. Cookie-/Tracking-Hinweis: Dieses Formular verwendet keine Tracking- oder Marketing-Cookies. Es werden ausschliesslich technisch notwendige Funktionen eingesetzt. Optionale Tracking-Dienste wuerden nur nach vorheriger ausdruecklicher Einwilligung aktiviert."
      ]
    },
    waiverDoc: {
      title: "Haftverzichtserklaerung",
      paragraphs: [
        "1. Geltung: Diese Haftverzichtserklaerung gilt fuer die Teilnahme an der Veranstaltung und ist Bestandteil der Anmeldeunterlagen.",
        "2. Eigenverantwortung: Der Teilnehmer nimmt auf eigene Gefahr teil und traegt die zivil- und strafrechtliche Verantwortung fuer durch ihn oder sein Fahrzeug verursachte Schaeden, soweit kein Haftungsausschluss vereinbart wurde.",
        "3. Verzicht auf Ansprueche: Mit Abgabe der Nennung wird auf Ansprueche jeder Art fuer Schaeden im Zusammenhang mit der Veranstaltung verzichtet, insbesondere gegen den DMV, den DMSB, deren Mitgliedsorganisationen, den Veranstalter sowie alle mit Organisation und Durchfuehrung befassten Personen und Erfuellungs-/Verrichtungsgehilfen.",
        "4. Weiterer Personenkreis: Der Verzicht gilt ebenfalls gegenueber anderen Teilnehmern, deren Helfern sowie Eigentuemern/Fahrzeugeigentuemern anderer Fahrzeuge und gegenueber eigenen Helfern.",
        "5. Ausnahmen: Ausgenommen vom Haftungsverzicht bleiben Ansprueche wegen Verletzung von Leben, Koerper oder Gesundheit sowie Ansprueche aus vorsaetzlicher oder grob fahrlaessiger Pflichtverletzung (auch gesetzlicher Vertreter oder Erfuellungsgehilfen).",
        "6. Erklaerungen des Teilnehmers: Der Teilnehmer bestaetigt, dass die Angaben in der Nennung richtig und vollstaendig sind, das Fahrzeug den technischen Bestimmungen entspricht und in technisch sowie optisch einwandfreiem Zustand eingesetzt wird.",
        "7. Regelakzeptanz: Der Teilnehmer bestaetigt die Kenntnis und Anerkennung der Ausschreibungsbedingungen, die Beachtung der Veranstaltungsregeln, den Besitz eines gueltigen Fuehrerscheins sowie den Verzicht auf verbotene Substanzen/Methoden.",
        "8. Daten- und Eigentumserklaerung: Der Teilnehmer erklaert sich mit Speicherung und Verarbeitung der Daten durch den Veranstalter einverstanden und bestaetigt, dass bei fehlendem Fahrzeugeigentum eine entsprechende Verzichtserklaerung des Eigentuemers vorgelegt wird.",
        "9. Hoehere Gewalt: Bei Absage der Veranstaltung aus hoeherer Gewalt (z. B. Unwetter, behoerdliche Auflagen) kann ein Anspruch auf Rueckerstattung des Nenngeldes ausgeschlossen sein."
      ]
    }
  },
  en: {
    shortInfo:
      "By submitting this registration, we process your personal data for registration handling, participant management, communication, document generation, and billing. Legal bases are Art. 6(1)(b) GDPR and, where legally required, Art. 6(1)(c) GDPR. Optional media processing is based on consent under Art. 6(1)(a) GDPR. Recipients are internal responsible teams and technical processors within AWS eu-central-1. Your rights of access, rectification, erasure, restriction, objection, and data portability remain unaffected.",
    waiverSignNotice: "The binding waiver is signed on-site during registration.",
    footerPrivacyLabel: "Privacy",
    footerImprintLabel: "Imprint",
    footerTermsLabel: "Terms",
    footerWaiverLabel: "Waiver",
    termsAcceptanceLabel: "I accept the participation terms and conditions.",
    privacyAcceptanceLabel: "I have read the privacy notice and accept data processing for event execution.",
    mediaAcceptanceLabel: "I consent to the use of photo/video material for event reporting, club website, and club social media channels.",
    minorNotice: "Minors may only be registered with explicit consent from a legal guardian.",
    guardianSectionTitle: "Legal guardian details (required for drivers under 18)",
    guardianFullNameLabel: "Legal guardian full name",
    guardianEmailLabel: "Legal guardian email",
    guardianPhoneLabel: "Legal guardian phone",
    guardianConsentLabel: "As legal guardian, I confirm participation of the minor driver.",
    imprintDoc: {
      title: "Imprint",
      paragraphs: [
        "Information pursuant to Section 5 DDG: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz.",
        "Representation: Represented by chairman Peter Liersch.",
        "Contact: E-mail info@msc-oberlausitzer-dreilaendereck.eu.",
        "Register entry: Register court Dresden, association register VR 5907.",
        "VAT ID: DE289954270.",
        "Responsible for content: MSC Oberlausitzer Dreilaendereck e.V."
      ]
    },
    privacyDoc: {
      title: "Privacy Notice",
      paragraphs: [
        "1. Controller: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz, e-mail info@msc-oberlausitzer-dreilaendereck.eu.",
        "2. Data protection officer: Stephan Jakab, contact via info@msc-oberlausitzer-dreilaendereck.eu.",
        "3. Purpose and legal basis: Registration processing, participant management, event operations including check-in/technical inspection, communication, document generation and billing. Legal bases are Art. 6(1)(b), Art. 6(1)(c), Art. 6(1)(f) GDPR; optional media processing only under Art. 6(1)(a) GDPR. Relevant BDSG provisions apply additionally.",
        "4. Data categories: Identification and contact data, participant and vehicle data, emergency contacts, status/process data, and consent evidence (version, timestamp, hash, locale, source).",
        "5. Recipients/processors: Internal responsible teams and AWS as processor (RDS, S3, SES, Cognito, CloudWatch, Lambda, EventBridge, API Gateway, Secrets Manager), region eu-central-1. Disclosure to other third parties only under legal obligation or explicit consent.",
        "6. Retention and deletion: Operational registration data usually 3 years after event end; communication/outbox data 12 months; export data 90 days; verification/idempotency data 30 days; audit data 24 months; billing/payment data up to 10 years where legally required. Data are deleted or restricted once purpose ceases or retention ends.",
        "7. Data subject rights: Access, rectification, erasure, restriction, objection, data portability, and withdrawal of consent with future effect.",
        "8. Right to lodge a complaint: You may lodge a complaint with a competent data protection authority.",
        "9. Technical security: Data transmission is encrypted via TLS/HTTPS. Absolute security of internet transmission cannot be guaranteed.",
        "10. Technical logs and required storage mechanisms: Technically required connection and server logs are processed. No marketing or analytics cookies are enabled. Technically required browser storage may be used for form functionality (e.g., language preference and draft data).",
        "11. Data security: Access follows the need-to-know principle; technical and organizational safeguards are implemented (e.g., access controls, logging, system updates).",
        "12. Obligation to provide data: Without required fields, participation processing is not possible.",
        "13. Contact requests: When contacting via e-mail or contact form (club website), submitted data are processed to handle the request and follow-up questions.",
        "14. Updates: This privacy notice may be adjusted if legal or organizational requirements change."
      ]
    },
    termsDoc: {
      title: "Participation Terms / GTC",
      paragraphs: [
        "1. Minors: Minor participants are permitted only with explicit legal guardian consent. For minors, guardian full name, e-mail, phone, and guardian confirmation are mandatory.",
        "2. Media consent (optional): Photo/video material may be used for event reporting, club website, and club social media channels.",
        "3. Withdrawal of media consent: Consent is voluntary and can be withdrawn at any time for future processing via info@msc-oberlausitzer-dreilaendereck.eu. Processing carried out before withdrawal remains lawful.",
        "4. Cookie/tracking note: This form uses no marketing or analytics cookies. Only technically required functionality is used. Optional tracking services would require prior explicit consent."
      ]
    },
    waiverDoc: {
      title: "Waiver",
      paragraphs: [
        "1. Scope: This waiver applies to participation in the event and is part of the registration documentation.",
        "2. Personal responsibility: Participation is at own risk; the participant bears civil and criminal responsibility for damages caused by the participant or their vehicle, unless liability exclusion applies.",
        "3. Waiver of claims: By submitting the registration, claims for damages connected to the event are waived, in particular against DMV, DMSB, their member organizations, the organizer, and all persons/entities involved in organization and execution.",
        "4. Extended group: The waiver also applies against other participants and their assistants, owners/vehicle owners of other vehicles, and own assistants.",
        "5. Exceptions: Claims for injury to life, body, or health and claims based on intent or gross negligence remain unaffected.",
        "6. Participant declarations: The participant confirms all registration information is correct and complete, and that the vehicle complies with technical requirements and is used in technically and visually proper condition.",
        "7. Rule acceptance: The participant confirms awareness and acceptance of event regulations, possession of a valid driving license, and refraining from prohibited substances/methods.",
        "8. Data and ownership declaration: The participant agrees to data processing by the organizer and confirms that, if not the vehicle owner, an owner waiver declaration is provided.",
        "9. Force majeure: If the event is canceled due to force majeure (e.g., weather or regulatory restrictions), refund claims for entry fees may be excluded."
      ]
    }
  },
  cz: {
    shortInfo:
      "Odeslanim registrace zpracovavame vase osobni udaje pro registraci, spravu ucastniku, komunikaci, tvorbu dokumentu a vyuctovani. Pravnimi zaklady jsou cl. 6 odst. 1 pism. b GDPR a pri zakonne povinnosti cl. 6 odst. 1 pism. c GDPR. Volitelne zpracovani medii probiha pouze na zaklade souhlasu podle cl. 6 odst. 1 pism. a GDPR. Prijemci jsou pouze interni odpovedne role a technicti zpracovatele v AWS eu-central-1. Vase prava na pristup, opravu, vymaz, omezeni, namitku a prenositelnost zustavaji nedotcena.",
    waiverSignNotice: "Zavazne prohlaseni o vzdani se odpovednosti se podepisuje osobne pri registraci na miste.",
    footerPrivacyLabel: "Ochrana udaju",
    footerImprintLabel: "Impressum",
    footerTermsLabel: "Podminky",
    footerWaiverLabel: "Vzdani se odpovednosti",
    termsAcceptanceLabel: "Souhlasim s podminkami ucasti.",
    privacyAcceptanceLabel: "Precetl(a) jsem informace o ochrane osobnich udaju a souhlasim se zpracovanim pro organizaci akce.",
    mediaAcceptanceLabel: "Souhlasim s pouzitim foto/video materialu pro report z akce, web klubu a klubove socialni site.",
    minorNotice: "Nezletile osoby lze registrovat pouze s vyraznym souhlasem zakonneho zastupce.",
    guardianSectionTitle: "Udaje zakonneho zastupce (povinne pro jezdce do 18 let)",
    guardianFullNameLabel: "Cele jmeno zakonneho zastupce",
    guardianEmailLabel: "E-mail zakonneho zastupce",
    guardianPhoneLabel: "Telefon zakonneho zastupce",
    guardianConsentLabel: "Jako zakonny zastupce potvrzuji ucast nezletileho jezdce.",
    imprintDoc: {
      title: "Impressum",
      paragraphs: [
        "Udaje podle § 5 DDG: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz.",
        "Zastoupeni: Zastoupeno predsedou Peterem Lierschem.",
        "Kontakt: E-mail info@msc-oberlausitzer-dreilaendereck.eu.",
        "Registrace: Registracni soud Dresden, VR 5907.",
        "DIC: DE289954270.",
        "Odpovednost za obsah: MSC Oberlausitzer Dreilaendereck e.V."
      ]
    },
    privacyDoc: {
      title: "Informace o ochrane osobnich udaju",
      paragraphs: [
        "1. Spravce: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz, e-mail info@msc-oberlausitzer-dreilaendereck.eu.",
        "2. Poverenec pro ochranu osobnich udaju: Stephan Jakab, kontakt pres info@msc-oberlausitzer-dreilaendereck.eu.",
        "3. Ucel a pravni zaklad: Prijem/zpracovani registrace, sprava ucastniku, organizace akce vcetne check-inu/technicke kontroly, komunikace, dokumenty a vyuctovani. Pravnim zakladem je cl. 6 odst. 1 pism. b, c, f GDPR; volitelne media pouze dle cl. 6 odst. 1 pism. a GDPR. Doplne plati prislusne predpisy BDSG.",
        "4. Kategorie udaju: Identifikacni a kontaktni udaje, udaje o ucastnikovi a vozidle, nouzove kontakty, stavove/procesni udaje a zaznamy o souhlasech (verze, cas, hash, locale, zdroj).",
        "5. Prijemci/zpracovatele: Interne odpovedne role a AWS jako zpracovatel (RDS, S3, SES, Cognito, CloudWatch, Lambda, EventBridge, API Gateway, Secrets Manager), region eu-central-1. Predani dalsim tretim stranam pouze pri pravni povinnosti nebo vyslovnem souhlasu.",
        "6. Doba uchovani a vymaz: Operativni registracni data obvykle 3 roky po skonceni akce; komunikacni/outbox data 12 mesicu; exporty 90 dni; verifikacni/idempotencni data 30 dni; auditni data 24 mesicu; fakturacni/platebni data az 10 let dle zakonnych povinnosti. Po splneni ucelu nebo uplynuti lhuty jsou data vymazana nebo omezena.",
        "7. Prava subjektu udaju: Pravo na pristup, opravu, vymaz, omezeni zpracovani, namitku, prenositelnost a odvolani souhlasu s ucinky do budoucna.",
        "8. Pravo podat stiznost: Muzete podat stiznost u prislusneho dozoru nad ochranou osobnich udaju.",
        "9. Technicka bezpecnost: Prenos dat je sifrovan pres TLS/HTTPS. Absolutni bezpecnost prenosu na internetu nelze zarucit.",
        "10. Technicke protokoly a nezbytne uloziste: Pri pouziti aplikace vznikaji technicky nezbytne pripojovaci a serverove logy. Marketingove ani analyticke cookies nejsou aktivovany. Pro funkci formulare muze byt pouzito technicky nezbytne uloziste prohlizece (napr. jazyk a koncepty formularu).",
        "11. Bezpecnost dat: Pristup k osobnim udajum je riditeln podle principu need-to-know; jsou zavedena technicka a organizacni opatreni (napr. opravneni, logovani, aktualizace systemu).",
        "12. Povinnost poskytnuti udaju: Bez povinnych udaju nelze registraci zpracovat.",
        "13. Kontaktni dotazy: Pri kontaktu e-mailem nebo formularen (klubovy web) jsou udaje zpracovany pro vyrizeni dotazu a navazujici komunikaci.",
        "14. Aktualizace: Tyto informace o ochrane osobnich udaju mohou byt upraveny pri zmene pravnich nebo organizacnich pozadavku."
      ]
    },
    termsDoc: {
      title: "Podminky ucasti / VOP",
      paragraphs: [
        "1. Nezletili: Nezletili ucastnici jsou povoleni pouze s vyslovnym souhlasem zakonneho zastupce. U nezletilych jsou povinne udaje zastupce (jmeno, e-mail, telefon) a potvrzeni souhlasu.",
        "2. Souhlas s medii (volitelny): Foto/video material muze byt pouzit pro report z akce, web klubu a klubove socialni site.",
        "3. Odvolani souhlasu s medii: Souhlas je dobrovolny a lze jej kdykoli odvolat pro budoucnost na adrese info@msc-oberlausitzer-dreilaendereck.eu. Zpracovani pred odvolanim zustava zakonne.",
        "4. Cookie/tracking: Formular nepouziva marketingove ani analyticke cookies. Pouzivaji se pouze technicky nezbytne funkce. Pripadne volitelne tracking sluzby by vyzadovaly predchozi vyslovny souhlas."
      ]
    },
    waiverDoc: {
      title: "Prohlaseni o vzdani se odpovednosti",
      paragraphs: [
        "1. Rozsah: Toto prohlaseni plati pro ucast na akci a je soucasti registracni dokumentace.",
        "2. Vlastni odpovednost: Ucast je na vlastni riziko; ucastnik nese obcanskopravni i trestnepravni odpovednost za skody zpusobene jim nebo jeho vozidlem, pokud neni sjednan vyluceni odpovednosti.",
        "3. Vzdani se naroku: Odeslanim registrace se ucastnik vzdava naroku na nahradu skody souvisejici s akci, zejmena vuci DMV, DMSB, jejich clenskym organizacim, poradatelum a vsem osobam/subjektum podilejicim se na organizaci a prubehu.",
        "4. Rozsireny okruh: Vzdani se naroku plati take vuci dalsim ucastnikum a jejich pomocnikum, vlastnikum vozidel jinych vozidel i vlastnim pomocnikum.",
        "5. Vyjimky: Nedotceny zustavaji naroky pri ujme na zivote, tele nebo zdravi a naroky zalozene na umyslu nebo hrube nedbalosti.",
        "6. Prohlaseni ucastnika: Ucastnik potvrzuje spravnost a uplnost registracnich udaju a to, ze vozidlo splnuje technicke pozadavky a je pouzito v technicky i vizualne zpusobilem stavu.",
        "7. Akceptace pravidel: Ucastnik potvrzuje znalost a akceptaci pravidel akce, platny ridicsky prukaz a zdrzeni se zakazanych latek/metod.",
        "8. Prohlaseni o datech a vlastnictvi: Ucastnik souhlasi se zpracovanim dat poradatelem a potvrzuje, ze pokud neni vlastnikem vozidla, predlozi odpovidajici prohlaseni vlastnika.",
        "9. Vyssi moc: Pri zruseni akce z duvodu vyssi moci (napr. pocasi nebo regulatorni omezeni) muze byt narok na vraceni startovneho vyloucen."
      ]
    }
  },
  pl: {
    shortInfo:
      "Wysyłając rejestrację, przetwarzamy Twoje dane osobowe w celu obsługi zgłoszenia, zarządzania uczestnikami, komunikacji, tworzenia dokumentów i rozliczeń. Podstawą prawną jest art. 6 ust. 1 lit. b RODO oraz, gdy jest to wymagane prawem, art. 6 ust. 1 lit. c RODO. Opcjonalne przetwarzanie materiałów medialnych odbywa się wyłącznie na podstawie zgody zgodnie z art. 6 ust. 1 lit. a RODO. Odbiorcami są wewnętrzne role organizacyjne oraz podmioty przetwarzające technicznie w AWS eu-central-1. Przysługują Ci prawa dostępu, sprostowania, usunięcia, ograniczenia, sprzeciwu i przenoszenia danych.",
    waiverSignNotice: "Wiążące oświadczenie o zrzeczeniu odpowiedzialności jest podpisywane na miejscu podczas rejestracji.",
    footerPrivacyLabel: "Prywatność",
    footerImprintLabel: "Impressum",
    footerTermsLabel: "Warunki udziału",
    footerWaiverLabel: "Zrzeczenie odpowiedzialności",
    termsAcceptanceLabel: "Akceptuję warunki udziału.",
    privacyAcceptanceLabel: "Zapoznałem(-am) się z informacją o prywatności i akceptuję przetwarzanie danych na potrzeby realizacji wydarzenia.",
    mediaAcceptanceLabel: "Wyrażam zgodę na wykorzystanie zdjęć/wideo do relacji z wydarzenia, strony klubu i klubowych kanałów social media.",
    minorNotice: "Osoby niepełnoletnie mogą zostać zarejestrowane wyłącznie za wyraźną zgodą opiekuna prawnego.",
    guardianSectionTitle: "Dane opiekuna prawnego (wymagane dla kierowców poniżej 18 lat)",
    guardianFullNameLabel: "Imię i nazwisko opiekuna prawnego",
    guardianEmailLabel: "E-mail opiekuna prawnego",
    guardianPhoneLabel: "Telefon opiekuna prawnego",
    guardianConsentLabel: "Jako opiekun prawny potwierdzam udział niepełnoletniego kierowcy.",
    imprintDoc: {
      title: "Impressum",
      paragraphs: [
        "Dane zgodnie z § 5 DDG: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz.",
        "Reprezentacja: reprezentowany przez przewodniczącego Petera Lierscha.",
        "Kontakt: info@msc-oberlausitzer-dreilaendereck.eu.",
        "Rejestr: sąd rejestrowy w Dreźnie, VR 5907.",
        "NIP UE: DE289954270.",
        "Podmiot odpowiedzialny za treść: MSC Oberlausitzer Dreilaendereck e.V."
      ]
    },
    privacyDoc: {
      title: "Informacja o prywatności",
      paragraphs: [
        "1. Administrator: MSC Oberlausitzer Dreilaendereck e.V., Am Weiher 4, 02791 Oderwitz, e-mail info@msc-oberlausitzer-dreilaendereck.eu.",
        "2. Inspektor ochrony danych: Stephan Jakab, kontakt przez info@msc-oberlausitzer-dreilaendereck.eu.",
        "3. Cel i podstawa prawna: obsługa rejestracji, zarządzanie uczestnikami, realizacja wydarzenia (w tym check-in i odbiór techniczny), komunikacja, dokumenty i rozliczenia. Podstawą są art. 6 ust. 1 lit. b, c, f RODO; media opcjonalnie wyłącznie na podstawie art. 6 ust. 1 lit. a RODO.",
        "4. Kategorie danych: dane identyfikacyjne i kontaktowe, dane uczestnika i pojazdu, kontakty awaryjne, dane statusowe/procesowe oraz potwierdzenia zgód (wersja, czas, hash, locale, źródło).",
        "5. Odbiorcy/podmioty przetwarzające: wewnętrzne role organizacyjne oraz AWS jako podmiot przetwarzający (RDS, S3, SES, Cognito, CloudWatch, Lambda, EventBridge, API Gateway, Secrets Manager), region eu-central-1.",
        "6. Okres przechowywania: dane operacyjne zwykle 3 lata po wydarzeniu; dane komunikacyjne/outbox 12 miesięcy; eksporty 90 dni; dane weryfikacyjne/idempotencyjne 30 dni; audyt 24 miesiące; dane księgowe/rozliczeniowe do 10 lat, jeśli wymagane prawem.",
        "7. Twoje prawa: dostęp, sprostowanie, usunięcie, ograniczenie przetwarzania, sprzeciw, przenoszenie danych oraz wycofanie zgody ze skutkiem na przyszłość.",
        "8. Prawo do skargi: możesz wnieść skargę do właściwego organu ochrony danych.",
        "9. Bezpieczeństwo: transmisja danych odbywa się szyfrowanym połączeniem TLS/HTTPS; pełne bezpieczeństwo transmisji internetowej nie może być zagwarantowane.",
        "10. Logi techniczne i niezbędne mechanizmy pamięci: aplikacja przetwarza techniczne logi połączeń i serwera; nie używa marketingowych ani analitycznych cookies; może używać niezbędnej pamięci przeglądarki (np. język i szkice formularza).",
        "11. Obowiązek podania danych: bez wymaganych danych realizacja zgłoszenia nie jest możliwa.",
        "12. Aktualizacje: niniejsza informacja o prywatności może być aktualizowana przy zmianach prawnych lub organizacyjnych."
      ]
    },
    termsDoc: {
      title: "Warunki udziału / Regulamin",
      paragraphs: [
        "1. Niepełnoletni: udział osób niepełnoletnich jest możliwy wyłącznie za wyraźną zgodą opiekuna prawnego. Wymagane są dane opiekuna (imię i nazwisko, e-mail, telefon) oraz potwierdzenie zgody.",
        "2. Zgoda na media (opcjonalna): zdjęcia/wideo mogą być wykorzystane do relacji z wydarzenia, na stronie klubu i w klubowych kanałach social media.",
        "3. Wycofanie zgody: zgoda jest dobrowolna i może zostać cofnięta w dowolnym momencie ze skutkiem na przyszłość pod adresem info@msc-oberlausitzer-dreilaendereck.eu.",
        "4. Cookies/tracking: formularz nie używa marketingowych ani analitycznych cookies. Wykorzystywane są wyłącznie funkcje technicznie niezbędne."
      ]
    },
    waiverDoc: {
      title: "Oświadczenie o zrzeczeniu odpowiedzialności",
      paragraphs: [
        "1. Zakres: niniejsze oświadczenie dotyczy udziału w wydarzeniu i stanowi część dokumentacji zgłoszeniowej.",
        "2. Odpowiedzialność własna: uczestnik bierze udział na własne ryzyko i ponosi odpowiedzialność cywilną oraz karną za szkody spowodowane przez siebie lub pojazd, o ile nie obowiązuje wyłączenie odpowiedzialności.",
        "3. Zrzeczenie roszczeń: wraz ze zgłoszeniem uczestnik zrzeka się roszczeń odszkodowawczych związanych z wydarzeniem, w szczególności wobec DMV, DMSB, organizatora oraz osób i podmiotów zaangażowanych w organizację i przebieg wydarzenia.",
        "4. Rozszerzony krąg: zrzeczenie obejmuje również innych uczestników, ich pomocników, właścicieli innych pojazdów oraz własnych pomocników.",
        "5. Wyjątki: zrzeczenie nie obejmuje roszczeń z tytułu uszczerbku na życiu, zdrowiu i ciele oraz roszczeń wynikających z działania umyślnego lub rażącego niedbalstwa.",
        "6. Oświadczenia uczestnika: uczestnik potwierdza poprawność i kompletność danych zgłoszenia oraz zgodność pojazdu z wymaganiami technicznymi.",
        "7. Akceptacja zasad: uczestnik potwierdza znajomość i akceptację regulaminu wydarzenia, posiadanie ważnego prawa jazdy oraz powstrzymanie się od substancji/metod zabronionych.",
        "8. Dane i własność: uczestnik wyraża zgodę na przetwarzanie danych przez organizatora i potwierdza, że jeśli nie jest właścicielem pojazdu, dostarczy odpowiednie oświadczenie właściciela.",
        "9. Siła wyższa: w przypadku odwołania wydarzenia z przyczyn siły wyższej (np. pogoda, decyzje administracyjne) zwrot opłaty startowej może być wyłączony."
      ]
    }
  }
};

function resolveLocale(locale: string): PersistedLegalTextsLocale {
  if (locale === "en" || locale === "cz" || locale === "de" || locale === "pl") {
    return locale;
  }
  return "de";
}

function normalizeForHash(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function getLegalTexts(locale: string): LegalTexts {
  return LEGAL_TEXTS[resolveLocale(locale)];
}

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

export function buildConsentDisplayText(locale: string): string {
  const texts = getLegalTexts(locale);
  return normalizeForHash(
    [
      texts.shortInfo,
      texts.termsAcceptanceLabel,
      texts.privacyAcceptanceLabel,
      texts.mediaAcceptanceLabel,
      texts.minorNotice,
      texts.privacyDoc.title,
      texts.termsDoc.title,
      texts.waiverDoc.title
    ].join("\n")
  );
}

export async function computeConsentTextHash(locale: string): Promise<string> {
  const source = buildConsentDisplayText(locale);
  const payload = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
