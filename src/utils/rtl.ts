import { I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

export let isRTL = true;
let nativeDirectionReloadInFlight = false;

export const setRTL = (value: boolean) => {
  isRTL = value;
};

export const syncNativeRTLDirection = async (value: boolean): Promise<boolean> => {
  setRTL(value);

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
  get flexDirection() {
    return isRTL ? 'row-reverse' : 'row';
  },
  get textAlign() {
    return isRTL ? 'right' : 'left';
  },
  get writingDirection() {
    return isRTL ? 'rtl' : 'ltr';
  },
};

export const getFlexDirection = (reverse: boolean = false) => {
  if (reverse) {
    return isRTL ? 'row' : 'row-reverse';
  }
  return isRTL ? 'row-reverse' : 'row';
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
