import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, I18nManager, Platform } from 'react-native';
import { Provider as PaperProvider, DefaultTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';

import AppNavigator from './src/navigation/AppNavigator';
import WelcomeScreen from './src/components/WelcomeScreen';
import AuthScreen from './src/components/AuthScreen';
import RTLWrapper from './src/components/RTLWrapper';
import { initDatabase } from './src/database/database';
import { getUserSettings } from './src/database/database';
import { gradientColors, colors } from './src/utils/gradientColors';
import NotificationService from './src/services/notificationService';

// Configure Cairo font for React Native Paper
const fontConfig = {
  config: {
    regular: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '400' as const,
      fontSize: 14,
      letterSpacing: 0.5,
      lineHeight: 20,
    },
    medium: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '600' as const,
      fontSize: 14,
      letterSpacing: 0.5,
      lineHeight: 20,
    },
    light: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '300' as const,
      fontSize: 14,
      letterSpacing: 0.5,
      lineHeight: 20,
    },
    thin: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '200' as const,
      fontSize: 14,
      letterSpacing: 0.5,
      lineHeight: 20,
    },
  },
};

// Custom dark theme with modern teal/cyan accents
const theme = {
  ...DefaultTheme,
  fonts: configureFonts(fontConfig),
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary, // Modern turquoise accent
    accent: colors.primary,  // Same turquoise for consistency
    background: colors.background, // Deep navy background
    surface: colors.surfaceCard, // Dark slate for cards
    text: colors.text, // White primary text
    onSurface: colors.text, // White text on dark surface
    placeholder: colors.textSecondary, // Light blue grey for placeholders
    backdrop: colors.overlay, // Dark overlay
    error: colors.error, // Red for negative amounts
    success: colors.success, // Teal for positive amounts
    warning: colors.warning, // Amber for warnings
    disabled: colors.surfaceLight, // Medium slate for disabled elements
  },
  roundness: 16, // Rounded corners
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load Cairo font from local file
  const [fontsLoaded] = useFonts({
    'Cairo-Regular': require('./assets/fonts/Cairo-Regular.ttf'),
  });

  useEffect(() => {
    // Initialize RTL layout - must be done before any rendering
    try {
      // Force RTL for Arabic app
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
      I18nManager.swapLeftAndRightInRTL(true);
      
      // Set global default font for all Text components (Android fix)
      if (Platform.OS === 'android') {
        // Set default props for Text component
        (Text as any).defaultProps = {
          ...(Text as any).defaultProps,
          style: [
            { fontFamily: 'Cairo-Regular' },
            (Text as any).defaultProps?.style,
          ],
        };
      }
      
      // Additional RTL enforcement
      if (!I18nManager.isRTL) {
        // Force reload if RTL is not enabled
        setTimeout(() => {
          if (!I18nManager.isRTL) {
          }
        }, 1000);
      }
      
     
    } catch (error) {
      console.error('RTL initialization error:', error);
    }

    const initializeApp = async () => {
      try {
        await initDatabase();
        
        // Initialize notification service
        const notificationService = NotificationService.getInstance();
        
        // Request permissions first
        const hasPermission = await notificationService.requestPermissions();
        
        // If permissions granted, setup notifications from database settings
        if (hasPermission) {
          try {
            const notificationSettings = await notificationService.getNotificationSettings();
            const { getAppSettings } = await import('./src/database/database');
            const appSettings = await getAppSettings();
            
            // Only setup notifications if they're enabled in app settings
            if (appSettings?.notificationsEnabled !== false) {
              await notificationService.setupNotifications(notificationSettings);
            }
          } catch (error) {
            console.warn('Could not setup notifications on startup:', error);
            // Continue app initialization even if notification setup fails
          }
        }
        
        // Check if user has completed setup
        const userSettings = await getUserSettings();
        
        if (userSettings) {
          // User has completed setup, check authentication
          if (userSettings.authMethod === 'none') {
            // No authentication required, go directly to app
            setIsAuthenticated(true);
          } else {
            // Authentication required, show auth screen
            setShowAuth(true);
          }
        } else {
          // No user settings found, show welcome screen
          setShowWelcome(true);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const handleGetStarted = () => {
    setShowWelcome(false);
    // After welcome setup, check if authentication is needed
    checkAuthenticationStatus();
  };

  const checkAuthenticationStatus = async () => {
    try {
      const userSettings = await getUserSettings();
      if (userSettings) {
        if (userSettings.authMethod === 'none') {
          setIsAuthenticated(true);
        } else {
          setShowAuth(true);
        }
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
    }
  };

  const handleAuthenticated = () => {
    setShowAuth(false);
    setIsAuthenticated(true);
  };

  if (isLoading || !fontsLoaded) {
    return (
      <LinearGradient
        colors={gradientColors.background.main}
        style={styles.loadingContainer}
      >
        <Text style={styles.loadingText}>دنانير</Text>
        <Text style={styles.loadingSubtext}>جاري التحميل...</Text>
      </LinearGradient>
    );
  }

  if (showWelcome) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <RTLWrapper style={styles.container}>
            <WelcomeScreen onGetStarted={handleGetStarted} />
            <StatusBar style="light" backgroundColor={colors.primaryDark} />
          </RTLWrapper>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  if (showAuth) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <RTLWrapper style={styles.container}>
            <AuthScreen onAuthenticated={handleAuthenticated} />
            <StatusBar style="light" backgroundColor={colors.primaryDark} />
          </RTLWrapper>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  if (isAuthenticated) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <RTLWrapper style={styles.container}>
            <AppNavigator />
            <StatusBar style="light" backgroundColor={colors.primaryDark} />
          </RTLWrapper>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  // Fallback loading state
  return (
    <LinearGradient
      colors={gradientColors.background.main}
      style={styles.loadingContainer}
    >
      <Text style={styles.loadingText}>دنانير</Text>
      <Text style={styles.loadingSubtext}>جاري التحميل...</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    
  },
  loadingText: {
    fontSize: 36,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: 'Cairo-Regular',
    textAlign: 'center',
  },
});
