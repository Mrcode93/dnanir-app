import { Platform, TextStyle, ViewStyle, I18nManager } from 'react-native';
import { colors } from './gradientColors';
import { RTLStyles } from './rtlStyles';

// Global text styles with Cairo font
export const globalTextStyles: { [key: string]: TextStyle } = {
  // Default text style
  default: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Title styles
  title: {
    fontFamily: 'Cairo-Regular',
    fontSize: 26,
    lineHeight: 36,
    fontWeight: '600',
    color: colors.text,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  subtitle: {
    fontFamily: 'Cairo-Regular',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    color: colors.text,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Body text styles
  body: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  bodyLarge: {
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  bodySmall: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Button text styles
  button: {
    fontFamily: 'Cairo-Regular',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  
  buttonLarge: {
    fontFamily: 'Cairo-Regular',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  
  // Label styles
  label: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Caption styles
  caption: {
    fontFamily: 'Cairo-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Error text
  error: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.error,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Success text
  success: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.success,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Warning text
  warning: {
    fontFamily: 'Cairo-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.warning,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Primary text
  primary: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
  },
  
  // Secondary text
  secondary: {
    fontFamily: 'Cairo-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: RTLStyles.textAlign.right as 'right',
    writingDirection: 'rtl' as const,
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

// Global container styles
export const globalContainerStyles: { [key: string]: ViewStyle } = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  row: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  rowReverse: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
  },
};
