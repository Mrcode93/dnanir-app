import React, { createContext, useContext } from 'react';
import { setRTL } from '../utils/rtl';
import { ar } from './resources/ar';
import { literalAr } from './resources/literal-ar';

export type AppLanguage = 'ar';
export type TranslationParams = Record<string, string | number | undefined>;
export type TranslateFn = (key: string, params?: TranslationParams) => string;
export type TranslateLiteralParams =
  | Array<string | number | undefined>
  | Record<string, string | number | undefined>;
export type TranslateLiteralFn = (text: string, params?: TranslateLiteralParams) => string;

const resources = {
  ar,
} as const;

const literalResources = {
  ar: literalAr,
} as const;

const languageDisplayNames = {
  ar: {
    ar: 'العربية',
    native: 'العربية',
  },
} as const;

const currencyDisplayNames: Record<string, Record<AppLanguage, string>> = {
  IQD: { ar: 'دينار عراقي' },
  USD: { ar: 'دولار أمريكي' },
  EUR: { ar: 'يورو' },
  GBP: { ar: 'جنيه إسترليني' },
  SAR: { ar: 'ريال سعودي' },
  AED: { ar: 'درهم إماراتي' },
  KWD: { ar: 'دينار كويتي' },
  EGP: { ar: 'جنيه مصري' },
  QAR: { ar: 'ريال قطري' },
  BHD: { ar: 'دينار بحريني' },
  OMR: { ar: 'ريال عماني' },
  JOD: { ar: 'دينار أردني' },
  LBP: { ar: 'ليرة لبنانية' },
  SYP: { ar: 'ليرة سورية' },
  TND: { ar: 'دينار تونسي' },
  MAD: { ar: 'درهم مغربي' },
  DZD: { ar: 'دينار جزائري' },
  LYD: { ar: 'دينار ليبي' },
  SDG: { ar: 'جنيه سوداني' },
  YER: { ar: 'ريال يمني' },
  TRY: { ar: 'ليرة تركية' },
  CAD: { ar: 'دولار كندي' },
  AUD: { ar: 'دولار أسترالي' },
  CHF: { ar: 'فرنك سويسري' },
  CNY: { ar: 'يوان صيني' },
  JPY: { ar: 'ين ياباني' },
  INR: { ar: 'روبية هندية' },
  RUB: { ar: 'روبل روسي' },
  BRL: { ar: 'ريال برازيلي' },
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
  return value === 'ar';
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
  const resolvedValue = typeof requestedValue === 'string'
    ? requestedValue
    : key;

  return interpolate(resolvedValue, params);
};

export const t = translate;

export const translateLiteral = (
  text: string,
  params?: TranslateLiteralParams,
  language: AppLanguage = currentLanguage,
): string => {
  const template = literalResources[language][text as keyof typeof literalAr]
    || text;

  return interpolateLiteral(template, params);
};

export const tl = translateLiteral;

export const getLanguageDisplayName = (
  language: AppLanguage,
  locale: AppLanguage = currentLanguage,
): string => {
  return languageDisplayNames[language][locale as keyof (typeof languageDisplayNames)['ar']];
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
