import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, Image, I18nManager, Platform, AppState } from 'react-native';
import { Provider as PaperProvider, Portal, DefaultTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LockScreen } from './src/screens/LockScreen';
import { initDatabase } from './src/database/database';
import { theme } from './src/utils/theme';
import { initializeNotifications } from './src/services/notificationService';
import { isAuthenticationEnabled } from './src/services/authService';
import { authEventService } from './src/services/authEventService';
import { AlertProvider } from './src/components/AlertProvider';
import { PrivacyProvider } from './src/context/PrivacyContext';

const fontConfig = {
  config: {
    regular: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '400' as const,
      fontSize: 16,
      letterSpacing: 0.5,
      lineHeight: 24,
    },
    medium: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '600' as const,
      fontSize: 16,
      letterSpacing: 0.5,
      lineHeight: 24,
    },
  },
};

const paperTheme = {
  ...DefaultTheme,
  fonts: configureFonts(fontConfig),
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    surface: theme.colors.surfaceCard,
    text: theme.colors.textPrimary,
    onSurface: theme.colors.textPrimary,
    placeholder: theme.colors.textMuted,
  },
  roundness: 16,
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const isUnlockedRef = useRef(false);
  const [fontsLoaded] = useFonts({
    'Cairo-Regular': require('./assets/fonts/Cairo-Regular.ttf'),
  });

  useEffect(() => {
    try {
      if (I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
        I18nManager.swapLeftAndRightInRTL(false);
      }

      if (Platform.OS === 'android') {
        (Text as any).defaultProps = {
          ...(Text as any).defaultProps,
          style: [
            {
              fontFamily: 'Cairo-Regular',
              textAlign: 'right',
              writingDirection: 'rtl',
            },
            (Text as any).defaultProps?.style,
          ],
        };
      }
    } catch (error) {
      console.error('LTR initialization error:', error);
    }

    const initializeApp = async () => {
      try {
        await initDatabase();
        await initializeNotifications();

        // Initialize achievements
        try {
          const { initializeAchievements, checkAllAchievements } = await import('./src/services/achievementService');
          await initializeAchievements();
          await checkAllAchievements();
        } catch (error) {
          console.error('Error initializing achievements:', error);
        }

        // Initialize widget data
        try {
          const { initializeWidgetData } = await import('./src/services/widgetDataService');
          await initializeWidgetData();
        } catch (error) {
          console.error('Error initializing widget data:', error);
        }

        const authEnabled = await isAuthenticationEnabled();
        setIsLocked(authEnabled);

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const checkAndUpdateAuthStatus = useCallback(async () => {
    try {
      if (authEventService.shouldKeepUnlocked()) {
        isUnlockedRef.current = true;
        setIsLocked(false);
        return;
      }

      const authEnabled = await isAuthenticationEnabled();

      if (!authEnabled) {
        isUnlockedRef.current = true;
        setIsLocked(false);
      } else if (!isUnlockedRef.current) {
        setIsLocked(true);
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      isUnlockedRef.current = true;
      setIsLocked(false);
    }
  }, []);

  useEffect(() => {
    let subscription: any;
    let appState = AppState.currentState;

    const checkAuthOnFocus = async () => {
      if (authEventService.shouldKeepUnlocked()) {
        isUnlockedRef.current = true;
        setIsLocked(false);
        return;
      }

      const authEnabled = await isAuthenticationEnabled();
      if (!authEnabled) {
        setIsLocked(false);
        isUnlockedRef.current = true;
      } else if (!isUnlockedRef.current) {
        setIsLocked(true);
      }

      // Re-initialize notifications when app comes to foreground
      try {
        await initializeNotifications();
      } catch (error) {
        console.error('Error re-initializing notifications on focus:', error);
      }
    };

    if (AppState.addEventListener) {
      subscription = AppState.addEventListener('change', (nextAppState) => {
        if (appState.match(/inactive|background/) && nextAppState === 'active') {
          checkAuthOnFocus();
        }
        if (nextAppState.match(/inactive|background/)) {
          isUnlockedRef.current = false;
        }
        appState = nextAppState;
      });
    }

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = authEventService.subscribe(() => {
      setTimeout(() => {
        checkAndUpdateAuthStatus();
      }, 150);
    });

    return unsubscribe;
  }, [checkAndUpdateAuthStatus]);

  // Check auth on focus is already handled by subscription and navigation listeners
  // Removing interval to prevent performance degradation on Android
  /*
  useEffect(() => {
    const interval = setInterval(() => {
      checkAndUpdateAuthStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [checkAndUpdateAuthStatus]);
  */

  const handleUnlock = () => {
    isUnlockedRef.current = true;
    setIsLocked(false);
  };

  if (isLoading || !fontsLoaded) {
    return (
      <LinearGradient
        colors={theme.gradients.primary as any}
        style={styles.loadingContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Image
          source={require('./assets/letters-logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </LinearGradient>
    );
  }

  if (isLocked) {
    return (
      <SafeAreaProvider>
        <LockScreen onUnlock={handleUnlock} />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AlertProvider>
          <PrivacyProvider>
            <PaperProvider theme={paperTheme}>
              <Portal.Host>
                <AppNavigator />
                <StatusBar style="dark" backgroundColor={theme.colors.background} />
              </Portal.Host>
            </PaperProvider>
          </PrivacyProvider>
        </AlertProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 200,
    height: 200,
    maxWidth: '80%',
    maxHeight: '80%',
  },
});
