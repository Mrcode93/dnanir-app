import { I18nManager, Platform } from 'react-native';

// Force RTL for Arabic app - always return true
// Note: On iOS, I18nManager.forceRTL() doesn't work dynamically,
// so we always use RTL layout regardless of I18nManager.isRTL value
export const isRTL = true; // Always RTL for this Arabic app

export const rtlStyles = {
  flexDirection: 'row' as const,
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
