import React, { createContext, useContext, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { es as esLocale, ca as caLocale, enUS as enLocale, it as itLocale } from 'date-fns/locale';
import type { Locale } from 'date-fns';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  dateLocale: Locale;
  availableLanguages: { code: string; name: string; nativeName: string }[];
}

const availableLanguages = [
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
];

const dateLocales: Record<string, Locale> = {
  es: esLocale,
  ca: caLocale,
  en: enLocale,
  it: itLocale,
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();

  const setLanguage = useCallback((lang: string) => {
    i18n.changeLanguage(lang);
  }, [i18n]);

  const dateLocale = dateLocales[i18n.language] || esLocale;

  const value: LanguageContextType = {
    language: i18n.language,
    setLanguage,
    dateLocale,
    availableLanguages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
