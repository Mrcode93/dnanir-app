type CurrencyListener = () => void;

const listeners = new Set<CurrencyListener>();

export const subscribeToCurrencyChanges = (listener: CurrencyListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notifyCurrencyChanged = (): void => {
  listeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      // Ignore listener errors
    }
  });
};
