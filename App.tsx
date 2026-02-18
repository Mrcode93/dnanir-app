import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, Image, I18nManager, Platform, AppState } from 'react-native';
import { Provider as PaperProvider, Portal, DefaultTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
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

// Prevent valid splash screen from auto-hiding
// We call this at top level to catch it as early as possible
SplashScreen.preventAutoHideAsync().catch(() => { });

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
      const startTime = Date.now();
      try {
        // Critical: Database must be ready first
        await initDatabase();

        // Only await the auth check — it's needed to decide lock screen
        const authEnabled = await isAuthenticationEnabled();
        setIsLocked(authEnabled);

        // Non-critical: fire-and-forget in background
        initializeNotifications().catch(e => console.warn('Notifications init skipped:', e));

        import('./src/services/achievementService').then(async ({ initializeAchievements, checkAllAchievements }) => {
          await initializeAchievements();
          await checkAllAchievements();
        }).catch(e => console.warn('Achievements init error:', e));

        import('./src/services/widgetDataService').then(async ({ initializeWidgetData }) => {
          await initializeWidgetData();
        }).catch(e => console.warn('Widget data init error:', e));

        // Brief splash so it doesn't just flash
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 600 - elapsed);
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    // We hide the native splash screen as soon as our root view is ready.
    // This happens for both our custom splash screen AND the actual app.
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      // Ignore errors if splash screen is already hidden
    }
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

  const handleUnlock = () => {
    isUnlockedRef.current = true;
    setIsLocked(false);
  };

  if (isLoading || !fontsLoaded) {
    return (
      <View
        style={styles.loadingContainer}
        onLayout={onLayoutRootView}
      >
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
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <LockScreen onUnlock={handleUnlock} />
        </SafeAreaProvider>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: activeTheme.colors.background }} onLayout={onLayoutRootView}>
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
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#003459',
    padding: 40,
  },
  splashImage: {
    width: '80%',
    height: '80%',
  },
});
