import { Platform } from 'react-native';

// Modern Light Theme Configuration - Refined
export const lightTheme = {
  colors: {
    primary: '#003459',
    primaryLight: '#60A5FA',
    primaryDark: '#1D4ED8',
    background: '#F8F9FA',
    backgroundSecondary: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceLight: '#F8F9FA',
    surfaceCard: '#FFFFFF',
    text: '#1F2937',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    border: '#E5E7EB',
    borderLight: '#D1D5DB',
    divider: 'rgba(0, 0, 0, 0.1)',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  gradients: {
    primary: ['#003459', '#004D73', '#006699'],
    success: ['#10B981', '#059669'],
    error: ['#EF4444', '#DC2626'],
    info: ['#003459', '#004D73'],
    goalPurple: ['#A78BFA', '#8B5CF6', '#7C3AED'],
    goalBlue: ['#60A5FA', '#3B82F6', '#2563EB'],
    goalPink: ['#F472B6', '#EC4899', '#DB2777'],
    goalOrange: ['#FB923C', '#F97316', '#EA580C'],
    goalTeal: ['#2DD4BF', '#14B8A6', '#0D9488'],
    goalIndigo: ['#818CF8', '#6366F1', '#4F46E5'],
    goalEmerald: ['#34D399', '#10B981', '#059669'],
    goalRose: ['#FB7185', '#F43F5E', '#E11D48'],
  },
  spacing: {
    xs: 4,
    sm: Platform.OS === 'android' ? 6 : 8,
    md: Platform.OS === 'android' ? 12 : 16,
    lg: Platform.OS === 'android' ? 18 : 24,
    xl: Platform.OS === 'android' ? 24 : 32,
    xxl: Platform.OS === 'android' ? 36 : 48,
    screenH: Platform.OS === 'android' ? 16 : 20,   // horizontal screen gutter
    touchMin: Platform.OS === 'android' ? 48 : 44,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,   // bottom sheets and dialogs
    round: 9999,
  },
  shadows: {
    xs: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    },
  },
  typography: {
    fontFamily: 'DINNext-Medium',
    sizes: {
      xs: 12,       // caption, badge, tiny label
      sm: 14,       // secondary text, helper text
      md: 16,       // body, input fields
      lg: 18,       // section titles, list items
      xl: 20,       // card titles
      xxl: 24,      // screen titles
      display: 40,  // hero number (balance, amounts)
    },
  },
};

export const darkTheme: AppTheme = {
  colors: {
    primary: '#4DA8DA',        // Lighter version of brand #003459 for dark surfaces
    primaryLight: '#7EC8E3',
    primaryDark: '#003459',    // Original brand color preserved
    background: '#0B1120',     // Deep navy black
    backgroundSecondary: '#111827',
    surface: '#151F2E',        // Elevated surface
    surfaceLight: '#1A2640',   // Slightly lighter
    surfaceCard: '#151F2E',
    text: '#E2E8F0',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0B1120',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    border: '#1E3048',
    borderLight: '#2A4060',
    divider: 'rgba(255, 255, 255, 0.08)',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.75)',
  },
  gradients: {
    primary: ['#003459', '#0A4D6E', '#1A6B8A'],
    success: ['#10B981', '#059669'],
    error: ['#EF4444', '#DC2626'],
    info: ['#003459', '#0A4D6E'],
    goalPurple: ['#A78BFA', '#8B5CF6', '#7C3AED'],
    goalBlue: ['#60A5FA', '#3B82F6', '#2563EB'],
    goalPink: ['#F472B6', '#EC4899', '#DB2777'],
    goalOrange: ['#FB923C', '#F97316', '#EA580C'],
    goalTeal: ['#2DD4BF', '#14B8A6', '#0D9488'],
    goalIndigo: ['#818CF8', '#6366F1', '#4F46E5'],
    goalEmerald: ['#34D399', '#10B981', '#059669'],
    goalRose: ['#FB7185', '#F43F5E', '#E11D48'],
  },
  spacing: lightTheme.spacing,
  borderRadius: lightTheme.borderRadius,
  shadows: {
    xs: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.7,
      shadowRadius: 24,
      elevation: 12,
    },
  },
  typography: lightTheme.typography,
};

export type AppTheme = typeof lightTheme;


let currentTheme: AppTheme = lightTheme;

export const setDarkMode = (dark: boolean) => {
  currentTheme = dark ? darkTheme : lightTheme;
};

export const getTheme = () => currentTheme;

export const theme = lightTheme;
export const defaultTheme = lightTheme;

// Helper function for platform-specific shadows.
// Pass the active theme to get correct shadow values in dark mode.
export const getPlatformShadow = (
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
  activeTheme?: AppTheme,
) => {
  const shadow = (activeTheme ?? lightTheme).shadows[size];
  if (Platform.OS === 'android') {
    return {
      elevation: shadow.elevation,
      shadowColor: shadow.shadowColor,
    };
  }
  return {
    shadowColor: shadow.shadowColor,
    shadowOffset: shadow.shadowOffset,
    shadowOpacity: shadow.shadowOpacity,
    shadowRadius: shadow.shadowRadius,
    elevation: shadow.elevation,
  };
};

export const getPlatformFontWeight = (weight: any = '400') => {
  if (Platform.OS === 'android') {
    // Android falls back to system font if custom font + numeric weight is used
    // and that weight isn't explicitly defined in a font family configuration.
    // For DINNext, we use 'normal' for bold weights if we don't have separate family entries.
    const boldWeights = ['500', '600', '700', '800', '900', 'bold'];
    if (boldWeights.includes(weight.toString())) {
      return 'normal';
    }
    return weight;
  }
  return weight;
};
