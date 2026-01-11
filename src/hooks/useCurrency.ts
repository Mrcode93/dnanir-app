import { useState, useEffect } from 'react';
import { getAppSettings } from '../database/database';
import { CURRENCIES } from '../types';
import { formatCurrencyAmount } from '../services/currencyService';

/**
 * Hook to get the selected currency and format function
 */
export const useCurrency = () => {
  const [currencyCode, setCurrencyCode] = useState<string>('IQD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCurrency = async () => {
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
    };

    loadCurrency();
    
    // Listen for currency changes (when user navigates back to screen)
    const interval = setInterval(() => {
      loadCurrency();
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, []);

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
      const appSettings = await getAppSettings();
      if (appSettings?.currency) {
        const currency = CURRENCIES.find(c => c.name === appSettings.currency);
        if (currency) {
          setCurrencyCode(currency.code);
        }
      }
    },
  };
};
