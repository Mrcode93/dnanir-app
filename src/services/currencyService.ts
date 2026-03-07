import { getExchangeRate, upsertExchangeRate } from '../database/database';
import { CURRENCIES, Currency } from '../types';

const RATE_CACHE_TTL_MS = 5 * 60 * 1000;
const rateCache = new Map<string, { rate: number; cachedAt: number }>();
const pendingRateLookups = new Map<string, Promise<number | null>>();
const missingRateWarnings = new Set<string>();

const getRateKey = (fromCurrency: string, toCurrency: string): string =>
  `${fromCurrency}->${toCurrency}`;

const isValidRate = (rate: number): boolean =>
  Number.isFinite(rate) && rate > 0;

const setRateCache = (fromCurrency: string, toCurrency: string, rate: number): void => {
  const now = Date.now();
  rateCache.set(getRateKey(fromCurrency, toCurrency), { rate, cachedAt: now });
  if (isValidRate(rate)) {
    rateCache.set(getRateKey(toCurrency, fromCurrency), { rate: 1 / rate, cachedAt: now });
  }
};

const readRateFromCache = (fromCurrency: string, toCurrency: string): number | null => {
  const key = getRateKey(fromCurrency, toCurrency);
  const cached = rateCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > RATE_CACHE_TTL_MS) {
    rateCache.delete(key);
    return null;
  }
  return cached.rate;
};

const loadRateFromDatabase = async (
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> => {
  const directRate = await getExchangeRate(fromCurrency, toCurrency);
  if (directRate && isValidRate(directRate.rate)) {
    setRateCache(fromCurrency, toCurrency, directRate.rate);
    return directRate.rate;
  }

  const reverseRate = await getExchangeRate(toCurrency, fromCurrency);
  if (reverseRate && isValidRate(reverseRate.rate)) {
    const normalizedRate = 1 / reverseRate.rate;
    setRateCache(fromCurrency, toCurrency, normalizedRate);
    return normalizedRate;
  }

  return null;
};

const getConversionRate = async (
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> => {
  const cachedRate = readRateFromCache(fromCurrency, toCurrency);
  if (cachedRate !== null) {
    return cachedRate;
  }

  const key = getRateKey(fromCurrency, toCurrency);
  const pendingLookup = pendingRateLookups.get(key);
  if (pendingLookup) {
    return pendingLookup;
  }

  const lookupPromise = loadRateFromDatabase(fromCurrency, toCurrency)
    .finally(() => {
      pendingRateLookups.delete(key);
    });

  pendingRateLookups.set(key, lookupPromise);
  return lookupPromise;
};

/**
 * Convert amount from one currency to another
 */
export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rate = await getConversionRate(fromCurrency, toCurrency);
  if (!rate) {
    const missingKey = getRateKey(fromCurrency, toCurrency);
    if (!missingRateWarnings.has(missingKey)) {
      missingRateWarnings.add(missingKey);
      console.warn(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
    }
    return amount;
  }

  return amount * rate;
};

/**
 * Get or fetch exchange rate
 */
export const getOrFetchExchangeRate = async (
  fromCurrency: string,
  toCurrency: string
): Promise<number> => {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  let rate = await getExchangeRate(fromCurrency, toCurrency);

  if (rate) {
    // Check if rate is older than 24 hours
    const updatedAt = new Date(rate.updatedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
      setRateCache(fromCurrency, toCurrency, rate.rate);
      return rate.rate;
    }
  }

  // Fetch from API (you can integrate with a real API here)
  // For now, return default rates
  const defaultRates: Record<string, Record<string, number>> = {
    IQD: { USD: 0.00076, EUR: 0.00070, GBP: 0.00060, SAR: 0.00285, AED: 0.00279, KWD: 0.00023, EGP: 0.023 },
    USD: { IQD: 1315, EUR: 0.92, GBP: 0.79, SAR: 3.75, AED: 3.67, KWD: 0.30, EGP: 30.9 },
    EUR: { IQD: 1430, USD: 1.09, GBP: 0.86, SAR: 4.08, AED: 4.00, KWD: 0.33, EGP: 33.6 },
    GBP: { IQD: 1660, USD: 1.27, EUR: 1.16, SAR: 4.76, AED: 4.66, KWD: 0.38, EGP: 39.1 },
    SAR: { IQD: 350, USD: 0.27, EUR: 0.25, GBP: 0.21, AED: 0.98, KWD: 0.08, EGP: 8.24 },
    AED: { IQD: 358, USD: 0.27, EUR: 0.25, GBP: 0.21, SAR: 1.02, KWD: 0.082, EGP: 8.42 },
    KWD: { IQD: 4350, USD: 3.31, EUR: 3.03, GBP: 2.63, SAR: 12.4, AED: 12.2, EGP: 102 },
    EGP: { IQD: 42.5, USD: 0.032, EUR: 0.030, GBP: 0.026, SAR: 0.121, AED: 0.119, KWD: 0.0098 },
  };

  const fetchedRate = defaultRates[fromCurrency]?.[toCurrency];

  if (fetchedRate) {
    await upsertExchangeRate({
      fromCurrency,
      toCurrency,
      rate: fetchedRate,
    });
    setRateCache(fromCurrency, toCurrency, fetchedRate);
    return fetchedRate;
  }

  return 1; // Default to 1 if no rate found
};

/**
 * Format currency amount
 */
export const formatCurrencyAmount = (
  amount: number | null | undefined,
  currencyCode: string
): string => {
  if (amount === null || amount === undefined) {
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    if (!currency) return `0.00 ${currencyCode}`;
    if (currencyCode === 'IQD') return `0 ${currency.symbol}`;
    return `${currency.symbol}0.00`;
  }

  const currency = CURRENCIES.find(c => c.code === currencyCode);
  if (!currency) {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }

  // Format based on currency
  if (currencyCode === 'IQD') {
    return `${amount.toLocaleString('en-US')} ${currency.symbol}`;
  }

  return `${currency.symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Get currency by code
 */
export const getCurrencyByCode = (code: string): Currency | undefined => {
  return CURRENCIES.find(c => c.code === code);
};

/**
 * Update exchange rates from API (placeholder for future implementation)
 */
export const updateExchangeRates = async (): Promise<void> => {
  // This would fetch from a real API like exchangerate-api.com or fixer.io
  // For now, we'll use default rates
  const commonPairs = [
    { fromCurrency: 'IQD', toCurrency: 'USD', rate: 0.00076 },
    { fromCurrency: 'USD', toCurrency: 'IQD', rate: 1315 },
    { fromCurrency: 'IQD', toCurrency: 'EUR', rate: 0.00070 },
    { fromCurrency: 'EUR', toCurrency: 'IQD', rate: 1430 },
  ];

  for (const pair of commonPairs) {
    await upsertExchangeRate(pair);
  }
};
