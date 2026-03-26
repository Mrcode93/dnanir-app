import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

export const isRTL = true;
let nativeDirectionReloadInFlight = false;

export const setRTL = (_value: boolean) => {
  // Always true for this app
};

export const syncNativeRTLDirection = async (value: boolean): Promise<boolean> => {
  if (I18nManager.isRTL === value) {
    I18nManager.swapLeftAndRightInRTL(false);
    return false;
  }

  I18nManager.allowRTL(value);
  I18nManager.forceRTL(value);
  I18nManager.swapLeftAndRightInRTL(false);

  if (nativeDirectionReloadInFlight) {
    return true;
  }

  nativeDirectionReloadInFlight = true;

  try {
    await Updates.reloadAsync();
  } catch (error) {
    nativeDirectionReloadInFlight = false;
    throw error;
  }

  return true;
};

export const rtlStyles = {
  flexDirection: 'row-reverse' as const,
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
};

export const getFlexDirection = (reverse: boolean = false) => {
  return reverse ? 'row' : 'row-reverse';
};

export const getMarginStart = (value: number) => ({
  marginStart: value,
});

export const getMarginEnd = (value: number) => ({
  marginEnd: value,
});

export const getPaddingStart = (value: number) => ({
  paddingStart: value,
});

export const getPaddingEnd = (value: number) => ({
  paddingEnd: value,
});
