import { I18nManager, Platform } from 'react-native';

// Force LTR for app - always return false
// Note: On iOS, I18nManager.forceRTL() doesn't work dynamically,
// so we always use LTR layout regardless of I18nManager.isRTL value
// Enable RTL for app
export const isRTL = true;

export const rtlStyles = {
  flexDirection: 'row-reverse' as const,
  textAlign: 'right' as const,
  writingDirection: 'rtl' as const,
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
