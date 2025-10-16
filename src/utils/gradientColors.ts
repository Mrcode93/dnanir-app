// Green gradient color scheme for the app
export const gradientColors = {
  // Primary green gradients
  primary: {
    light: ['#00E676', '#00D4AA'] as const, // Light to medium green
    medium: ['#00D4AA', '#00B894'] as const, // Medium to dark green
    dark: ['#00B894', '#00A085'] as const, // Dark to darker green
    vibrant: ['#00E676', '#00B894'] as const, // Light to dark vibrant
  },
  
  // Background gradients
  background: {
    main: ['#1A1A1A', '#2C2C2C'] as const, // Dark charcoal to dark gray
    card: ['#2C2C2C', '#404040'] as const, // Card background gradient
    surface: ['#404040', '#2C2C2C'] as const, // Surface gradient
  },
  
  // Accent gradients
  accent: {
    success: ['#00E676', '#00D4AA'] as const, // Success green gradient
    warning: ['#FFB74D', '#FF9800'] as const, // Warning orange gradient
    error: ['#FF5252', '#E53935'] as const, // Error red gradient
    info: ['#00D4AA', '#00B894'] as const, // Info green gradient
  },
  
  // Button gradients
  button: {
    primary: ['#00D4AA', '#00B894'] as const, // Primary button gradient
    secondary: ['#404040', '#2C2C2C'] as const, // Secondary button gradient
    success: ['#00E676', '#00D4AA'] as const, // Success button gradient
    danger: ['#FF5252', '#E53935'] as const, // Danger button gradient
  },
  
  // Chart gradients
  chart: {
    green1: ['#2E7D32', '#4CAF50'] as const,
    green2: ['#4CAF50', '#8BC34A'] as const,
    green3: ['#8BC34A', '#CDDC39'] as const,
    green4: ['#00D4AA', '#00E676'] as const,
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

// Color constants for non-gradient elements
export const colors = {
  primary: '#00D4AA',
  primaryLight: '#00E676',
  primaryDark: '#00B894',
  background: '#1A1A1A',
  surface: '#2C2C2C',
  surfaceLight: '#404040',
  text: '#FFFFFF',
  textSecondary: '#9E9E9E',
  textMuted: '#757575',
  success: '#00D4AA',
  warning: '#FF9800',
  error: '#FF5252',
  border: '#404040',
  shadow: '#00D4AA',
};
