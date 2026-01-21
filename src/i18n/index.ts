import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Spanish translations
import esCommon from './locales/es/common.json';
import esAuth from './locales/es/auth.json';
import esDashboard from './locales/es/dashboard.json';
import esCustomers from './locales/es/customers.json';

// Catalan translations
import caCommon from './locales/ca/common.json';
import caAuth from './locales/ca/auth.json';
import caDashboard from './locales/ca/dashboard.json';
import caCustomers from './locales/ca/customers.json';

// English translations
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enCustomers from './locales/en/customers.json';

const resources = {
  es: {
    common: esCommon,
    auth: esAuth,
    dashboard: esDashboard,
    customers: esCustomers,
  },
  ca: {
    common: caCommon,
    auth: caAuth,
    dashboard: caDashboard,
    customers: caCustomers,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    customers: enCustomers,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: ['es', 'ca', 'en'],

    defaultNS: 'common',
    ns: ['common', 'auth', 'dashboard', 'customers'],

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'app-language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },
  });

export default i18n;
