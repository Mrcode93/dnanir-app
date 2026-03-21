import React, { createContext, useContext } from 'react';
import { setRTL } from '../utils/rtl';
import { ar } from './resources/ar';
import { en } from './resources/en';
import { literalAr } from './resources/literal-ar';
import { literalEn } from './resources/literal-en';

export type AppLanguage = 'ar' | 'en';
export type TranslationParams = Record<string, string | number | undefined>;
export type TranslateFn = (key: string, params?: TranslationParams) => string;
export type TranslateLiteralParams =
  | Array<string | number | undefined>
  | Record<string, string | number | undefined>;
export type TranslateLiteralFn = (text: string, params?: TranslateLiteralParams) => string;

const resources = {
  ar,
  en,
} as const;

const literalResources = {
  ar: literalAr,
  en: literalEn,
} as const;

const languageDisplayNames = {
  ar: {
    ar: 'العربية (العراق)',
    en: 'Arabic (Iraq)',
    native: 'العربية (العراق)',
  },
  en: {
    ar: 'الإنجليزية',
    en: 'English',
    native: 'English',
  },
} as const;

const currencyDisplayNames: Record<string, Record<AppLanguage, string>> = {
  IQD: { ar: 'دينار عراقي', en: 'Iraqi Dinar' },
  USD: { ar: 'دولار أمريكي', en: 'US Dollar' },
  EUR: { ar: 'يورو', en: 'Euro' },
  GBP: { ar: 'جنيه إسترليني', en: 'British Pound' },
  SAR: { ar: 'ريال سعودي', en: 'Saudi Riyal' },
  AED: { ar: 'درهم إماراتي', en: 'UAE Dirham' },
  KWD: { ar: 'دينار كويتي', en: 'Kuwaiti Dinar' },
  EGP: { ar: 'جنيه مصري', en: 'Egyptian Pound' },
  QAR: { ar: 'ريال قطري', en: 'Qatari Riyal' },
  BHD: { ar: 'دينار بحريني', en: 'Bahraini Dinar' },
  OMR: { ar: 'ريال عماني', en: 'Omani Rial' },
  JOD: { ar: 'دينار أردني', en: 'Jordanian Dinar' },
  LBP: { ar: 'ليرة لبنانية', en: 'Lebanese Pound' },
  SYP: { ar: 'ليرة سورية', en: 'Syrian Pound' },
  TND: { ar: 'دينار تونسي', en: 'Tunisian Dinar' },
  MAD: { ar: 'درهم مغربي', en: 'Moroccan Dirham' },
  DZD: { ar: 'دينار جزائري', en: 'Algerian Dinar' },
  LYD: { ar: 'دينار ليبي', en: 'Libyan Dinar' },
  SDG: { ar: 'جنيه سوداني', en: 'Sudanese Pound' },
  YER: { ar: 'ريال يمني', en: 'Yemeni Rial' },
  TRY: { ar: 'ليرة تركية', en: 'Turkish Lira' },
  CAD: { ar: 'دولار كندي', en: 'Canadian Dollar' },
  AUD: { ar: 'دولار أسترالي', en: 'Australian Dollar' },
  CHF: { ar: 'فرنك سويسري', en: 'Swiss Franc' },
  CNY: { ar: 'يوان صيني', en: 'Chinese Yuan' },
  JPY: { ar: 'ين ياباني', en: 'Japanese Yen' },
  INR: { ar: 'روبية هندية', en: 'Indian Rupee' },
  RUB: { ar: 'روبل روسي', en: 'Russian Ruble' },
  BRL: { ar: 'ريال برازيلي', en: 'Brazilian Real' },
};

let currentLanguage: AppLanguage = 'ar';

const getNestedValue = (source: unknown, key: string): unknown => {
  return key.split('.').reduce<unknown>((accumulator, currentKey) => {
    if (!accumulator || typeof accumulator !== 'object') {
      return undefined;
    }
    return (accumulator as Record<string, unknown>)[currentKey];
  }, source);
};

const interpolate = (template: string, params?: TranslationParams): string => {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, match) => {
    const value = params[match];
    return value === undefined ? `{{${match}}}` : String(value);
  });
};

const interpolateLiteral = (
  template: string,
  params?: TranslateLiteralParams,
): string => {
  if (!params) {
    return template;
  }

  if (Array.isArray(params)) {
    let index = 0;
    return template.replace(/\{\{\}\}/g, () => {
      const value = params[index];
      index += 1;
      return value === undefined ? '{{}}' : String(value);
    });
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, match) => {
    const value = params[match];
    return value === undefined ? `{{${match}}}` : String(value);
  });
};

export const isSupportedLanguage = (value: string): value is AppLanguage => {
  return value === 'ar' || value === 'en';
};

export const isLanguageRTL = (language: AppLanguage) => language === 'ar';

export const getCurrentLanguage = (): AppLanguage => currentLanguage;

export const setCurrentLanguage = (language: AppLanguage) => {
  currentLanguage = language;
  setRTL(isLanguageRTL(language));
};

export const translate = (
  key: string,
  params?: TranslationParams,
  language: AppLanguage = currentLanguage,
): string => {
  const requestedValue = getNestedValue(resources[language], key);
  const fallbackValue = getNestedValue(resources.ar, key);
  const resolvedValue = typeof requestedValue === 'string'
    ? requestedValue
    : typeof fallbackValue === 'string'
      ? fallbackValue
      : key;

  return interpolate(resolvedValue, params);
};

export const t = translate;

export const translateLiteral = (
  text: string,
  params?: TranslateLiteralParams,
  language: AppLanguage = currentLanguage,
): string => {
  const template = literalResources[language][text]
    || literalResources.ar[text]
    || text;

  return interpolateLiteral(template, params);
};

export const tl = translateLiteral;

export const getLanguageDisplayName = (
  language: AppLanguage,
  locale: AppLanguage = currentLanguage,
): string => {
  return languageDisplayNames[language][locale];
};

export const getLanguageNativeName = (language: AppLanguage): string => {
  return languageDisplayNames[language].native;
};

export const getCurrencyDisplayName = (
  currencyCode: string,
  language: AppLanguage = currentLanguage,
): string => {
  return currencyDisplayNames[currencyCode]?.[language] || currencyCode;
};

export type LocalizationContextValue = {
  language: AppLanguage;
  isRTL: boolean;
  setLanguage: (language: AppLanguage) => void;
  t: TranslateFn;
  tl: TranslateLiteralFn;
};

export const LocalizationContext = createContext<LocalizationContextValue>({
  language: 'ar',
  isRTL: true,
  setLanguage: () => { },
  t: translate,
  tl: translateLiteral,
});

export const LocalizationProvider: React.FC<{
  value: LocalizationContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => useContext(LocalizationContext);
