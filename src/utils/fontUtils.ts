import { Platform } from 'react-native';

// Font configuration for consistent Cairo font usage across the app
export const fontConfig = {
  // Primary font family - use same name for both platforms
  fontFamily: 'Cairo-Regular',
  
  // Font weights - use same name for both platforms
  regular: 'Cairo-Regular',
  medium: 'Cairo-Regular',
  light: 'Cairo-Regular',
  bold: 'Cairo-Regular',
  
  // Font sizes
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
    '4xl': 28,
    '5xl': 32,
  },
  
  // Line heights
  lineHeights: {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
    '2xl': 32,
    '3xl': 36,
    '4xl': 40,
    '5xl': 44,
  },
};

// Helper function to get font style
export const getFontStyle = (size: keyof typeof fontConfig.sizes = 'md', weight: 'regular' | 'medium' | 'light' | 'bold' = 'regular') => {
  return {
    fontFamily: fontConfig[weight],
    fontSize: fontConfig.sizes[size],
    lineHeight: fontConfig.lineHeights[size],
  };
};

// Default text style for consistent font usage
export const defaultTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.md,
  lineHeight: fontConfig.lineHeights.md,
};

// Title text style
export const titleTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes['2xl'],
  lineHeight: fontConfig.lineHeights['2xl'],
  fontWeight: '600' as const,
};

// Subtitle text style
export const subtitleTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.lg,
  lineHeight: fontConfig.lineHeights.lg,
  fontWeight: '500' as const,
};

// Small text style
export const smallTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.sm,
  lineHeight: fontConfig.lineHeights.sm,
};

// Large text style
export const largeTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.xl,
  lineHeight: fontConfig.lineHeights.xl,
  fontWeight: '600' as const,
};

// Button text style
export const buttonTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.md,
  lineHeight: fontConfig.lineHeights.md,
  fontWeight: '600' as const,
};

// Input text style
export const inputTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.md,
  lineHeight: fontConfig.lineHeights.md,
};

// Label text style
export const labelTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.sm,
  lineHeight: fontConfig.lineHeights.sm,
  fontWeight: '500' as const,
};

// Caption text style
export const captionTextStyle = {
  fontFamily: fontConfig.fontFamily,
  fontSize: fontConfig.sizes.xs,
  lineHeight: fontConfig.lineHeights.xs,
};
