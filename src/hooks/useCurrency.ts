import { useState, useEffect, useCallback } from 'react';
import { getAppSettings } from '../database/database';
import { CURRENCIES } from '../types';
import { formatCurrencyAmount } from '../services/currencyService';
import { subscribeToCurrencyChanges } from '../services/currencyEvents';

/**
 * Hook to get the selected currency and format function
 */
export const useCurrency = () => {
  const [currencyCode, setCurrencyCode] = useState<string>('IQD');
  const [loading, setLoading] = useState(true);

  const loadCurrency = useCallback(async () => {
    try {
      const appSettings = await getAppSettings();
      if (appSettings?.currency) {
        const currency = CURRENCIES.find(c => c.name === appSettings.currency);
        if (currency) {
          setCurrencyCode(currency.code);
        }
      }
    } catch (error) {
      console.error('Error loading currency:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrency();
    const unsubscribe = subscribeToCurrencyChanges(() => {
      loadCurrency();
    });
    return () => {
      unsubscribe();
    };
  }, [loadCurrency]);

  const formatCurrency = (amount: number): string => {
    return formatCurrencyAmount(amount, currencyCode);
  };

  const getCurrency = () => {
    return CURRENCIES.find(c => c.code === currencyCode);
  };

  return {
    currencyCode,
    currency: getCurrency(),
    formatCurrency,
    loading,
    refreshCurrency: async () => {
      await loadCurrency();
    },
  };
};
