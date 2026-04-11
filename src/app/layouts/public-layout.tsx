import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnmeldungI18nProvider, type AnmeldungLocale, useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { DocumentMeta } from "@/app/document-meta";
import { PublicLegalProvider, usePublicLegal } from "@/app/legal/public-legal-context";
import { publicContactEmail, publicWebsiteUrl } from "@/config/public-info";
import { ApiError } from "@/services/api/http-client";
import { formatPriceRange, resolvePublicPricing } from "@/lib/public-pricing";
import { registrationService } from "@/services/registration.service";
import type { PublicEventOverview } from "@/types/registration";

type HeaderEvent = {
  name: string;
  startsAt: string;
  endsAt: string;
  registrationCloseAt: string | null;
  pricingRules: PublicEventOverview["pricingRules"];
};

function toIntlLocale(locale: AnmeldungLocale) {
  if (locale === "de") return "de-DE";
  if (locale === "cz") return "cs-CZ";
  if (locale === "pl") return "pl-PL";
  return "en-US";
}

function eventDateTitle(locale: AnmeldungLocale) {
  if (locale === "en") return "Event date";
  if (locale === "cz") return "Datum akce";
  if (locale === "pl") return "Data wydarzenia";
  return "Eventdatum";
}

function parseEventDate(value: string): Date | null {
  const datePrefix = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (datePrefix) {
    const [, year, month, day] = datePrefix;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: string, locale: AnmeldungLocale) {
  const parsed = parseEventDate(value);
  if (!parsed) {
    return value;
  }
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(parsed);
}

function formatDateRange(startsAt: string, endsAt: string, locale: AnmeldungLocale) {
  if (!startsAt && !endsAt) {
    return "";
  }
  if (!endsAt || startsAt === endsAt) {
    return formatDate(startsAt, locale);
  }
  return `${formatDate(startsAt, locale)} - ${formatDate(endsAt, locale)}`;
}

function latePhaseLabel(locale: AnmeldungLocale) {
  if (locale === "en") return "2nd registration phase";
  if (locale === "cz") return "2. faze registrace";
  if (locale === "pl") return "2. faza rejestracji";
  return "2. Anmeldephase";
}

function priceTitle(locale: AnmeldungLocale) {
  if (locale === "en") return "Entry fee";
  if (locale === "cz") return "Startovné";
  if (locale === "pl") return "Opłata startowa";
  return "Startgeld";
}

function priceFallback(locale: AnmeldungLocale) {
  if (locale === "en") return "Will be published with event data";
  if (locale === "cz") return "Bude zveřejněno s daty akce";
  if (locale === "pl") return "Zostanie opublikowana z danymi wydarzenia";
  return "Wird mit den Eventdaten veröffentlicht";
}

function secondVehiclePriceHint(locale: AnmeldungLocale, priceLabel: string) {
  if (!priceLabel) {
    return "";
  }
  if (locale === "en") {
    return `Second vehicle: ${priceLabel}`;
  }
  if (locale === "cz") {
    return `Druhé vozidlo: ${priceLabel}`;
  }
  if (locale === "pl") {
    return `Drugi pojazd: ${priceLabel}`;
  }
  return `Zweites Fahrzeug: ${priceLabel}`;
}

function PublicLayoutContent() {
  const location = useLocation();
  const { locale, setLocale, m } = useAnmeldungI18n();
  const { texts: legalTexts } = usePublicLegal();
  const [headerEvent, setHeaderEvent] = useState<HeaderEvent | null>(null);

  useEffect(() => {
    let active = true;
    registrationService
      .getCurrentEvent()
      .then((response) => {
        if (!active) {
          return;
        }
        setHeaderEvent({
          name: response.name,
          startsAt: response.startsAt,
          endsAt: response.endsAt,
          registrationCloseAt: response.registrationCloseAt,
          pricingRules: response.pricingRules
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setHeaderEvent(null);
          return;
        }
        setHeaderEvent(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const headerDateBadge = useMemo(() => {
    if (!headerEvent) {
      return "";
    }
    const label = formatDateRange(headerEvent.startsAt, headerEvent.endsAt, locale);
    return label || "";
  }, [headerEvent, locale]);

  const headerTitle = headerEvent?.name || "";
  const displayEventTitle = headerTitle || m.layout.title;
  const headerWebsiteUrl = publicWebsiteUrl;
  const headerContactEmail = publicContactEmail;
  const pricingSnapshot = useMemo(() => {
    if (!headerEvent) {
      return null;
    }
    return resolvePublicPricing(headerEvent.pricingRules, headerEvent.registrationCloseAt);
  }, [headerEvent]);

  const headerPrice = useMemo(() => {
    if (!pricingSnapshot?.entryPrice) {
      return priceFallback(locale);
    }
    const formatted = formatPriceRange(locale, pricingSnapshot.entryPrice);
    const perVehicle = locale === "en" ? "per vehicle" : locale === "cz" ? "za vozidlo" : locale === "pl" ? "za pojazd" : "pro Fahrzeug";
    if (pricingSnapshot.phase === "late") {
      return `${formatted} ${perVehicle} (${latePhaseLabel(locale)})`;
    }
    return `${formatted} ${perVehicle}`;
  }, [locale, pricingSnapshot]);

  const headerSecondVehiclePrice = useMemo(() => {
    if (!pricingSnapshot?.secondVehiclePrice || !headerEvent?.pricingRules) {
      return "";
    }
    const discountCents = Math.max(0, headerEvent.pricingRules.secondVehicleDiscountCents ?? 0);
    if (discountCents <= 0) {
      return "";
    }
    const priceLabel = formatPriceRange(locale, pricingSnapshot.secondVehiclePrice);
    return secondVehiclePriceHint(locale, priceLabel);
  }, [headerEvent, locale, pricingSnapshot]);

  const headerDeadline = useMemo(() => {
    if (!pricingSnapshot || !pricingSnapshot.deadlineAt) {
      return "";
    }
    return formatDate(pricingSnapshot.deadlineAt.toISOString(), locale);
  }, [locale, pricingSnapshot]);

  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-slate-50">
      <DocumentMeta />
      {location.pathname.startsWith("/anmeldung/verify") ? (
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-5 sm:py-6 md:px-6 md:py-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              {headerDateBadge && (
                <div className="inline-flex rounded bg-yellow-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">
                  {eventDateTitle(locale)}: {headerDateBadge}
                </div>
              )}
              <div className="rounded-full border border-white/35 bg-white/10 p-1">
                <div className="flex items-center gap-1">
                  <span className="px-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground/90">{m.languageLabel}</span>
                  {(["de", "en", "cz", "pl"] as AnmeldungLocale[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLocale(lang)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                        locale === lang ? "bg-yellow-400 text-slate-900 shadow-sm" : "text-white hover:bg-white/20"
                      ].join(" ")}
                    >
                      {lang === "de" ? "DE" : lang === "en" ? "EN" : lang === "cz" ? "CZ" : "PL"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold md:text-3xl">{displayEventTitle}</h1>
              {headerWebsiteUrl && (
                <a
                  href={headerWebsiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  {m.layout.websiteButton}
                </a>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 md:px-6 md:py-12">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {headerDateBadge && (
                <div className="inline-flex rounded bg-yellow-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">
                  {eventDateTitle(locale)}: {headerDateBadge}
                </div>
              )}
              <div className="rounded-full border border-white/35 bg-white/10 p-1">
                <div className="flex items-center gap-1">
                  <span className="px-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground/90">{m.languageLabel}</span>
                  {(["de", "en", "cz", "pl"] as AnmeldungLocale[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLocale(lang)}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                        locale === lang ? "bg-yellow-400 text-slate-900 shadow-sm" : "text-white hover:bg-white/20"
                      ].join(" ")}
                    >
                      {lang === "de" ? "DE" : lang === "en" ? "EN" : lang === "cz" ? "CZ" : "PL"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div className="space-y-4 sm:space-y-5">
                {headerTitle && <h1 className="text-3xl font-semibold md:text-5xl">{headerTitle}</h1>}
                <p className="text-sm text-primary-foreground/90 md:text-base">{m.layout.subtitle}</p>
                <div className="flex flex-wrap gap-2">
                  {headerWebsiteUrl && (
                    <a
                      href={headerWebsiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300"
                    >
                      {m.layout.websiteButton}
                    </a>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded border border-white/25 bg-white/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-primary-foreground/80">{priceTitle(locale)}</div>
                  <div className="mt-1 text-sm font-semibold">{headerPrice}</div>
                  {headerSecondVehiclePrice && <div className="mt-1 text-xs text-primary-foreground/85">{headerSecondVehiclePrice}</div>}
                </div>
                <div className="rounded border border-white/25 bg-white/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-primary-foreground/80">{m.layout.infoDeadlineTitle}</div>
                  <div className="mt-1 text-sm font-semibold">{headerDeadline}</div>
                </div>
                <div className="rounded border border-white/25 bg-white/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-primary-foreground/80">{m.layout.infoContactTitle}</div>
                  <div className="mt-1 text-sm font-semibold">
                    {headerContactEmail && (
                      <a href={`mailto:${headerContactEmail}`} className="hover:underline">
                        {headerContactEmail}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-4 md:px-6 md:py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-slate-600 md:flex-row md:items-center md:justify-between md:px-6">
          <p>{m.layout.footerCopyright}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/anmeldung/rechtliches/impressum" className="hover:text-primary">
              {legalTexts?.footerImprintLabel ?? "Impressum"}
            </Link>
            <Link to="/anmeldung/rechtliches/datenschutz" className="hover:text-primary">
              {legalTexts?.footerPrivacyLabel ?? "Datenschutz"}
            </Link>
            <Link to="/anmeldung/rechtliches/teilnahmebedingungen" className="hover:text-primary">
              {legalTexts?.footerTermsLabel ?? "Teilnahmebedingungen"}
            </Link>
            <Link to="/anmeldung/rechtliches/haftverzicht" className="hover:text-primary">
              {legalTexts?.footerWaiverLabel ?? "Haftverzicht"}
            </Link>
            {headerWebsiteUrl && (
              <a href={headerWebsiteUrl} target="_blank" rel="noreferrer" className="hover:text-primary">
                {m.layout.footerWebsite}
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PublicLayout() {
  return (
    <AnmeldungI18nProvider>
      <PublicLegalProvider>
        <PublicLayoutContent />
      </PublicLegalProvider>
    </AnmeldungI18nProvider>
  );
}
