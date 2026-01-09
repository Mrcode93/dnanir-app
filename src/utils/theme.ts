// Modern Light Theme Configuration
export const theme = {
  colors: {
    // Primary colors - vibrant blue
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    primaryDark: '#1D4ED8',
    
    // Background colors - light theme
    background: '#F8F9FA',
    backgroundSecondary: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceLight: '#F8F9FA',
    surfaceCard: '#FFFFFF',
    
    // Text colors
    text: '#1F2937',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    // Status colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    
    // Border and divider
    border: '#E5E7EB',
    borderLight: '#D1D5DB',
    divider: 'rgba(0, 0, 0, 0.1)',
    
    // Shadow
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  gradients: {
    primary: ['#3B82F6', '#2563EB', '#1D4ED8'],
    success: ['#10B981', '#059669'],
    error: ['#EF4444', '#DC2626'],
    info: ['#3B82F6', '#2563EB'],
    // Modern gradient colors for goals
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
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    round: 9999,
  },
  
  shadows: {
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
  },
  
  typography: {
    fontFamily: 'Cairo-Regular',
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
