import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ca from './locales/ca.json';
import es from './locales/es.json';
import en from './locales/en.json';

// Detectar idioma del localStorage o del navegador
const getInitialLanguage = () => {
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage) return savedLanguage;

  // Si no hi ha idioma guardat, usar el del navegador
  const browserLang = navigator.language.split('-')[0];
  if (['ca', 'es', 'en'].includes(browserLang)) {
    return browserLang;
  }

  // Per defecte: espanyol
  return 'es';
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ca: { translation: ca },
      es: { translation: es },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // React ja fa l'escape
    },
  });

// Guardar l'idioma al localStorage quan canvii
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
