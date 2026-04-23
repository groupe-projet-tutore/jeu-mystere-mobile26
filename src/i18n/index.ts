// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import des traductions
import fr from './locales/fr.json';
import en from './locales/en.json';
import so from './locales/so.json';
import ar from './locales/ar.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  so: { translation: so },
  ar: { translation: ar },
};

const LANGUAGE_STORAGE_KEY = '@app_language';

const getStoredLanguage = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const initLanguage = async () => {
  const stored = await getStoredLanguage();
  if (stored && ['fr', 'en', 'so', 'ar'].includes(stored)) {
    return stored;
  }
  const systemLanguage = Localization.getLocales()[0]?.languageCode || 'fr';
  return ['fr', 'en', 'so', 'ar'].includes(systemLanguage) ? systemLanguage : 'fr';
};

// Initialisation sans compatibilityJSON (supprimé)
initLanguage().then((lng) => {
  i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false,
    },
  });
});

i18n.on('languageChanged', async (lng) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {}
});

export default i18n;
export const changeLanguage = i18n.changeLanguage.bind(i18n);
export const currentLanguage = () => i18n.language;