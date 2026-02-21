import React, { createContext, useContext, useState, useCallback } from 'react';
import { ru, TranslationKeys } from './ru';
import { tr } from './tr';
import { en } from './en';

export type Language = 'ru' | 'tr' | 'en';

export const languages: Record<Language, { label: string; flag: string }> = {
  ru: { label: 'Русский', flag: '🇷🇺' },
  tr: { label: 'Türkçe', flag: '🇹🇷' },
  en: { label: 'English', flag: '🇬🇧' },
};

const translations: Record<Language, TranslationKeys> = { ru, tr, en };

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationKeys;
}

export const I18nContext = createContext<I18nContextType>({
  lang: 'ru',
  setLang: () => {},
  t: ru,
});

export function useI18n() {
  return useContext(I18nContext);
}

export function useI18nProvider(): I18nContextType {
  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('pto-lang')) as Language | null;
  const [lang, setLangState] = useState<Language>(saved && translations[saved] ? saved : 'ru');

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('pto-lang', newLang);
  }, []);

  return {
    lang,
    setLang,
    t: translations[lang],
  };
}

export { ru, tr, en };
export type { TranslationKeys };
