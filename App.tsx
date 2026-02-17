import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, Image, I18nManager, Platform, AppState } from 'react-native';
import { Provider as PaperProvider, Portal, DefaultTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { clerkTokenCache } from './src/services/clerkTokenCache';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LockScreen } from './src/screens/LockScreen';
import { initDatabase } from './src/database/database';
import { lightTheme, darkTheme } from './src/utils/theme-constants';
import { ThemeProvider } from './src/utils/theme-context';
import { initializeNotifications } from './src/services/notificationService';
import { isAuthenticationEnabled } from './src/services/authService';
import { authEventService } from './src/services/authEventService';
import { syncNewToServer } from './src/services/syncService';
import { AlertProvider } from './src/components/AlertProvider';
import { PrivacyProvider } from './src/context/PrivacyContext';
import PushNotificationManager from './src/components/PushNotificationManager';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

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

// paperTheme will be defined inside the App function to be reactive to theme changes

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);

  const activeTheme = isDark ? darkTheme : lightTheme;

  const paperTheme = useMemo(() => ({
    ...DefaultTheme,
    fonts: configureFonts(fontConfig),
    colors: {
      ...DefaultTheme.colors,
      primary: activeTheme.colors.primary,
      background: activeTheme.colors.background,
      surface: activeTheme.colors.surfaceCard,
      text: activeTheme.colors.textPrimary,
      onSurface: activeTheme.colors.textPrimary,
      placeholder: activeTheme.colors.textMuted,
    },
    roundness: 16,
  }), [activeTheme]);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashComplete(true);
    }, 3000);
    return () => clearTimeout(timer);
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

  const lastSyncRef = useRef<number>(0);
  const SYNC_THROTTLE_MS = 60 * 1000; // 1 minute

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

      // Auto-sync when app comes to foreground (Pro only, throttled) – only if user enabled auto-sync
      try {
        const { getAppSettings } = await import('./src/database/database');
        const appSettings = await getAppSettings();
        if (appSettings?.autoSyncEnabled) {
          const now = Date.now();
          if (now - lastSyncRef.current >= SYNC_THROTTLE_MS) {
            lastSyncRef.current = now;
            syncNewToServer().catch(() => { });
          }
        }
      } catch (_) { }
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

  if (isLoading || !fontsLoaded || !splashComplete) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: activeTheme.colors.primary }]}>
        <Image
          source={require('./assets/images/dnanir-splash.png')}
          style={styles.splashImage}
          resizeMode="contain"
        />
      </View>
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
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={clerkTokenCache}>
      <ClerkLoaded>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AlertProvider>
              <PrivacyProvider>
                <ThemeProvider value={{ theme: activeTheme, isDark, setIsDark }}>
                  <PaperProvider theme={paperTheme}>
                    <Portal.Host>
                      <PushNotificationManager />
                      <AppNavigator />
                      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={activeTheme.colors.background} />
                    </Portal.Host>
                  </PaperProvider>
                </ThemeProvider>
              </PrivacyProvider>
            </AlertProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
  },
});
