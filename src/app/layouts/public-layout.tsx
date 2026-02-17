import { Link, Outlet } from "react-router-dom";
import { AnmeldungI18nProvider, type AnmeldungLocale, useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";

function PublicLayoutContent() {
  const { locale, setLocale, m } = useAnmeldungI18n();

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 md:px-6 md:py-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded bg-yellow-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-900">
              {m.layout.dateBadge}
            </div>
            <div className="rounded-full border border-white/35 bg-white/10 p-1">
              <div className="flex items-center gap-1">
                <span className="px-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground/90">{m.languageLabel}</span>
                {(["de", "en", "cz"] as AnmeldungLocale[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLocale(lang)}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      locale === lang ? "bg-yellow-400 text-slate-900 shadow-sm" : "text-white hover:bg-white/20"
                    ].join(" ")}
                  >
                    {lang === "de" ? "DE" : lang === "en" ? "EN" : "CZ"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="space-y-4 sm:space-y-5">
              <h1 className="text-3xl font-semibold md:text-5xl">{m.layout.title}</h1>
              <p className="text-sm text-primary-foreground/90 md:text-base">{m.layout.subtitle}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://www.msc-oberlausitz.de"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-yellow-300"
                >
                  {m.layout.websiteButton}
                </a>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded border border-white/25 bg-white/10 p-3">
                <div className="text-xs uppercase tracking-wide text-primary-foreground/80">{m.layout.infoDeadlineTitle}</div>
                <div className="mt-1 text-sm font-semibold">{m.layout.infoDeadlineValue}</div>
              </div>
              <div className="rounded border border-white/25 bg-white/10 p-3">
                <div className="text-xs uppercase tracking-wide text-primary-foreground/80">{m.layout.infoCheckinTitle}</div>
                <div className="mt-1 text-sm font-semibold">{m.layout.infoCheckinValue}</div>
              </div>
              <div className="rounded border border-white/25 bg-white/10 p-3">
                <div className="text-xs uppercase tracking-wide text-primary-foreground/80">{m.layout.infoContactTitle}</div>
                <div className="mt-1 text-sm font-semibold">{m.layout.infoContactValue}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 md:px-6 md:py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-slate-600 md:flex-row md:items-center md:justify-between md:px-6">
          <p>{m.layout.footerCopyright}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/anmeldung/rechtliches/impressum" className="hover:text-primary">
              {m.layout.footerImprint}
            </Link>
            <Link to="/anmeldung/rechtliches/datenschutz" className="hover:text-primary">
              {m.layout.footerPrivacy}
            </Link>
            <Link to="/anmeldung/rechtliches/haftung" className="hover:text-primary">
              {m.layout.footerLiability}
            </Link>
            <a href="https://www.msc-oberlausitz.de" target="_blank" rel="noreferrer" className="hover:text-primary">
              {m.layout.footerWebsite}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PublicLayout() {
  return (
    <AnmeldungI18nProvider>
      <PublicLayoutContent />
    </AnmeldungI18nProvider>
  );
}
