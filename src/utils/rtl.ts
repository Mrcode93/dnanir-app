import { I18nManager, Platform } from 'react-native';

// Force LTR for app - always return false
// Note: On iOS, I18nManager.forceRTL() doesn't work dynamically,
// so we always use LTR layout regardless of I18nManager.isRTL value
export const isRTL = false; // Always LTR for this app

export const rtlStyles = {
  flexDirection: 'row' as const,
  textAlign: 'left' as const,
  writingDirection: 'ltr' as const,
};

export const getFlexDirection = (reverse: boolean = false) => {
  return reverse ? 'row-reverse' : 'row';
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
