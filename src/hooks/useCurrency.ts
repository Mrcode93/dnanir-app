import { useState, useEffect, useCallback } from 'react';
import { getAppSettings } from '../database/database';
import { CURRENCIES } from '../types';
import { formatCurrencyAmount } from '../services/currencyService';
import { subscribeToCurrencyChanges } from '../services/currencyEvents';
import { usePrivacy } from '../context/PrivacyContext';

/**
 * Hook to get the selected currency and format function
 */
export const useCurrency = () => {
  const [currencyCode, setCurrencyCode] = useState<string>('IQD');
  const [loading, setLoading] = useState(true);
  const { isPrivacyEnabled } = usePrivacy();

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

  const formatCurrencyRaw = useCallback((amount: number): string => {
    return formatCurrencyAmount(amount, currencyCode);
  }, [currencyCode]);

  const formatCurrency = useCallback((
    amount: number,
    options?: { ignorePrivacy?: boolean }
  ): string => {
    if (isPrivacyEnabled && !options?.ignorePrivacy) {
      return '****';
    }
    return formatCurrencyAmount(amount, currencyCode);
  }, [currencyCode, isPrivacyEnabled]);

  const getCurrency = () => {
    return CURRENCIES.find(c => c.code === currencyCode);
  };

  return {
    currencyCode,
    selectedCurrency: currencyCode,
    currency: getCurrency(),
    formatCurrency,
    formatCurrencyRaw,
    loading,
    refreshCurrency: async () => {
      await loadCurrency();
    },
  };
};
