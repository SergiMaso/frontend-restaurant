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

// Italian translations
import itCommon from './locales/it/common.json';
import itAuth from './locales/it/auth.json';
import itDashboard from './locales/it/dashboard.json';
import itCustomers from './locales/it/customers.json';

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
  it: {
    common: itCommon,
    auth: itAuth,
    dashboard: itDashboard,
    customers: itCustomers,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    supportedLngs: ['es', 'ca', 'en', 'it'],

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
