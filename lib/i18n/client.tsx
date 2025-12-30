'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'fr' | 'en' | 'ar';

interface Translations {
  [key: string]: any;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  translations: Translations;
}

// Create context with a default value to prevent SSR issues
const I18nContext = createContext<I18nContextType>({
  locale: 'fr',
  setLocale: () => {},
  t: (key: string) => key,
  translations: {},
});

// Load translations
async function loadTranslations(locale: Locale): Promise<Translations> {
  try {
    const translations = await import(`@/messages/${locale}.json`);
    return translations.default;
  } catch (error) {
    console.error(`Failed to load translations for locale: ${locale}`, error);
    // Fallback to French
    const fallback = await import(`@/messages/fr.json`);
    return fallback.default;
  }
}

// Get nested value from object using dot notation
function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((current, key) => current?.[key], obj) || path;
}

export function I18nProvider({ children, initialLocale = 'fr' }: { children: ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load translations when locale changes
    loadTranslations(locale).then((trans) => {
      setTranslations(trans);
      setIsLoaded(true);
    });

    // Save locale to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale);
      document.documentElement.lang = locale;
      // Set RTL for Arabic
      if (locale === 'ar') {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
    }
  }, [locale]);

  // Load initial locale from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale;
      if (savedLocale && ['fr', 'en', 'ar'].includes(savedLocale)) {
        setLocaleState(savedLocale);
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    // Return empty string if translations not loaded yet
    if (!isLoaded) {
      return '';
    }

    let translation = getNestedValue(translations, key);
    
    // If translation not found, return the key
    if (typeof translation !== 'string') {
      return key;
    }

    // Replace parameters
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
      });
    }

    return translation;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, translations }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  return context;
}

