import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAnmeldungI18n } from "@/app/i18n/anmeldung-i18n";
import { registrationService } from "@/services/registration.service";
import type { PublicLegalBundle } from "@/types/registration";

type PublicLegalContextValue = {
  consent: PublicLegalBundle["consent"] | null;
  texts: PublicLegalBundle["texts"] | null;
  availableLocales: string[];
  loading: boolean;
  error: Error | null;
};

const PublicLegalContext = createContext<PublicLegalContextValue | null>(null);

export function PublicLegalProvider({ children }: { children: ReactNode }) {
  const { locale } = useAnmeldungI18n();
  const [value, setValue] = useState<PublicLegalContextValue>({
    consent: null,
    texts: null,
    availableLocales: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    let active = true;
    setValue((current) => ({
      ...current,
      loading: true,
      error: null
    }));

    registrationService
      .getPublicLegalBundle(locale)
      .then((bundle) => {
        if (!active) {
          return;
        }
        setValue({
          consent: bundle.consent,
          texts: bundle.texts,
          availableLocales: bundle.availableLocales,
          loading: false,
          error: null
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setValue({
          consent: null,
          texts: null,
          availableLocales: [],
          loading: false,
          error: error instanceof Error ? error : new Error("PUBLIC_LEGAL_LOAD_FAILED")
        });
      });

    return () => {
      active = false;
    };
  }, [locale]);

  const memoizedValue = useMemo(() => value, [value]);

  return <PublicLegalContext.Provider value={memoizedValue}>{children}</PublicLegalContext.Provider>;
}

export function usePublicLegal() {
  const context = useContext(PublicLegalContext);
  if (!context) {
    throw new Error("PUBLIC_LEGAL_CONTEXT_MISSING");
  }
  return context;
}
