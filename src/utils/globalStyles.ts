import { Platform, TextStyle } from 'react-native';
import { colors } from './gradientColors';

// Global text styles with Cairo font
export const globalTextStyles: { [key: string]: TextStyle } = {
  // Default text style
  default: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  
  // Title styles
  title: {
    fontFamily: 'Cairo-Regular',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    color: colors.text,
  },
  
  subtitle: {
    fontFamily: 'Cairo-Regular',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.text,
  },
  
  // Body text styles
  body: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  
  bodyLarge: {
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  
  bodySmall: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.text,
  },
  
  // Button text styles
  button: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.text,
  },
  
  buttonLarge: {
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.text,
  },
  
  // Label styles
  label: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  
  // Caption styles
  caption: {
    fontFamily: 'Cairo-Regular',
    fontSize: 10,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  
  // Error text
  error: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.error,
  },
  
  // Success text
  success: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.success,
  },
  
  // Warning text
  warning: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: colors.warning,
  },
  
  // Primary text
  primary: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  
  // Secondary text
  secondary: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
};

// Helper function to get text style
export const getTextStyle = (styleName: keyof typeof globalTextStyles): TextStyle => {
  return globalTextStyles[styleName] || globalTextStyles.default;
};

// Helper function to combine text styles
export const combineTextStyles = (...styles: (TextStyle | undefined)[]): TextStyle => {
  return Object.assign({}, ...styles.filter(Boolean));
};
