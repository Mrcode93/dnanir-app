// Modern teal/cyan gradient color scheme for the app
export const gradientColors = {
  // Primary teal/cyan gradients
  primary: {
    light: ['#00CED1', '#20B2AA'] as const, // Light teal to medium turquoise
    medium: ['#20B2AA', '#008B8B'] as const, // Medium turquoise to dark cyan
    dark: ['#008B8B', '#006666'] as const, // Dark cyan to deeper teal
    vibrant: ['#00CED1', '#008B8B'] as const, // Light teal to dark cyan vibrant
  },
  
  // Background gradients
  background: {
    main: ['#0F1419', '#1A2332'] as const, // Deep navy to dark slate
    card: ['#1E2832', '#2A3441'] as const, // Dark slate to medium slate
    surface: ['#2A3441', '#1E2832'] as const, // Medium slate to dark slate
  },
  
  // Accent gradients
  accent: {
    success: ['#00CED1', '#20B2AA'] as const, // Success teal gradient
    warning: ['#FFA726', '#FB8C00'] as const, // Warning amber gradient
    error: ['#EF5350', '#E53935'] as const, // Error red gradient
    info: ['#42A5F5', '#1E88E5'] as const, // Info blue gradient
  },
  
  // Button gradients
  button: {
    primary: ['#20B2AA', '#008B8B'] as const, // Primary button gradient
    secondary: ['#2A3441', '#1E2832'] as const, // Secondary button gradient
    success: ['#00CED1', '#20B2AA'] as const, // Success button gradient
    danger: ['#EF5350', '#E53935'] as const, // Danger button gradient
  },
  
  // Chart gradients
  chart: {
    teal1: ['#008B8B', '#20B2AA'] as const,
    teal2: ['#20B2AA', '#00CED1'] as const,
    cyan1: ['#00BCD4', '#00ACC1'] as const,
    cyan2: ['#00ACC1', '#0097A7'] as const,
  },
};

// Helper function to get gradient colors
export const getGradientColors = (type: keyof typeof gradientColors, variant?: string) => {
  const gradientType = gradientColors[type];
  if (typeof gradientType === 'object' && variant && variant in gradientType) {
    return gradientType[variant as keyof typeof gradientType];
  }
  return gradientType;
};

// Modern color constants for non-gradient elements
export const colors = {
  primary: '#20B2AA', // Turquoise
  primaryLight: '#00CED1', // Dark turquoise
  primaryDark: '#008B8B', // Dark cyan
  background: '#0F1419', // Deep navy
  surface: '#1E2832', // Dark slate
  surfaceLight: '#2A3441', // Medium slate
  surfaceCard: '#252F3D', // Card background
  text: '#FFFFFF', // White
  textSecondary: '#B0BEC5', // Light blue grey
  textMuted: '#78909C', // Medium blue grey
  success: '#00CED1', // Teal
  warning: '#FFA726', // Amber
  error: '#EF5350', // Red
  info: '#42A5F5', // Blue
  border: '#37474F', // Dark blue grey
  borderLight: '#546E7A', // Medium blue grey
  shadow: '#000000', // Black shadow
  overlay: 'rgba(0, 0, 0, 0.7)', // Dark overlay
};
