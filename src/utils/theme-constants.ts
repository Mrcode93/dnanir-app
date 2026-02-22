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
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
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
    fontFamily: 'Tajawal-Regular',
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      display: 36,
    },
  },
};

export const darkTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    background: '#0F172A',
    backgroundSecondary: '#1E293B',
    surface: '#1E293B',
    surfaceLight: '#334155',
    surfaceCard: '#1E293B',
    text: '#F1F5F9',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textInverse: '#0F172A',
    border: '#334155',
    borderLight: '#475569',
    divider: 'rgba(255, 255, 255, 0.1)',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
};

export type AppTheme = typeof lightTheme;

let currentTheme: AppTheme = lightTheme;

export const setDarkMode = (dark: boolean) => {
  currentTheme = dark ? darkTheme : lightTheme;
};

export const getTheme = () => currentTheme;

export const theme = lightTheme;
export const defaultTheme = lightTheme;

// Helper function for platform-specific shadows
export const getPlatformShadow = (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
  const shadow = lightTheme.shadows[size];
  if (Platform.OS === 'android') {
    return {
      elevation: shadow.elevation,
      shadowColor: 'transparent',
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
    if (weight === '700' || weight === '800' || weight === 'bold') {
      return 'normal';
    }
    return weight;
  }
  return weight;
};
