import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, TextInput, Image, I18nManager, Platform, AppState, useColorScheme, Appearance, LogBox, InteractionManager, TouchableOpacity } from 'react-native';

// Ignore specific logs that shouldn't interrupt the developer flow
LogBox.ignoreLogs([
  'GET request error',
  'POST request error',
  'PUT request error',
  'DELETE request error',
  'Network request failed',
  'Aborted',
]);
import { Provider as PaperProvider, Portal, DefaultTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AppNavigator } from './src/navigation/AppNavigator';
// import { LockScreen } from './src/screens/LockScreen'; // Disabled: app lock feature is off
import { initDatabase } from './src/database/database';
import { lightTheme, darkTheme } from './src/utils/theme-constants';
import { ThemeProvider, ThemeMode } from './src/utils/theme-context';
import { initializeNotifications, runSmartFinancialAlerts } from './src/services/notificationService';
import { isAuthenticationEnabled } from './src/services/authService';
import { authEventService } from './src/services/authEventService';
import { syncNewToServer } from './src/services/syncService';
import { AlertProvider } from './src/components/AlertProvider';
import { PrivacyProvider } from './src/context/PrivacyContext';
import PushNotificationManager from './src/components/PushNotificationManager';
import { VideoSplash } from './src/components/VideoSplash';

// Prevent valid splash screen from auto-hiding
// We call this at top level to catch it as early as possible
SplashScreen.preventAutoHideAsync().catch(() => { });

const fontConfig = {
  config: {
    regular: {
      fontFamily: 'DINNext-Regular',
      fontWeight: '400' as const,
      fontSize: 16,
      letterSpacing: 0.5,
      lineHeight: 24,
    },
    medium: {
      fontFamily: 'DINNext-Medium',
      fontWeight: '600' as const,
      fontSize: 16,
      letterSpacing: 0.5,
      lineHeight: 24,
    },
    light: {
      fontFamily: 'DINNext-Light',
      fontWeight: '300' as const,
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
  const [isDbReady, setIsDbReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initRunId, setInitRunId] = useState(0);
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isVideoFinished, setIsVideoFinished] = useState(false);

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return (systemColorScheme || Appearance.getColorScheme()) === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemColorScheme]);

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
  const dbReadyRef = useRef(false);
  const deferredStartupRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const hasQueuedDeferredStartupRef = useRef(false);
  const lastNotificationRefreshRef = useRef(0);
  const [fontsLoaded] = useFonts({
    'DINNext-Regular': require('./assets/fonts/din-next-lt-w23-regular-1.ttf'),
    'DINNext-Medium': require('./assets/fonts/din-next-lt-w23-medium.ttf'),
    'DINNext-Light': require('./assets/fonts/din-next-lt-w23-ultra-light-1.ttf'),
  });

  useEffect(() => {
    try {
      if (I18nManager.isRTL) {
        I18nManager.allowRTL(false);
        I18nManager.forceRTL(false);
        I18nManager.swapLeftAndRightInRTL(false);
      }

      const isAndroid = Platform.OS === 'android';
      const defaultTypographyStyle = {
        fontFamily: 'DINNext-Regular',
        ...(isAndroid
          ? {
            textAlign: 'right' as const,
            writingDirection: 'rtl' as const,
            includeFontPadding: false as const,
          }
          : {}),
      };

      (Text as any).defaultProps = {
        ...(Text as any).defaultProps,
        ...(isAndroid ? { allowFontScaling: false, maxFontSizeMultiplier: 1 } : {}),
        style: [
          defaultTypographyStyle,
          (Text as any).defaultProps?.style,
        ],
      };

      (TextInput as any).defaultProps = {
        ...(TextInput as any).defaultProps,
        ...(isAndroid ? { allowFontScaling: false, maxFontSizeMultiplier: 1 } : {}),
        style: [
          defaultTypographyStyle,
          (TextInput as any).defaultProps?.style,
        ],
      };
    } catch (error) {
      console.error('LTR initialization error:', error);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initializeApp = async () => {
      const startTime = Date.now();
      setIsLoading(true);
      setInitError(null);
      setIsDbReady(false);
      dbReadyRef.current = false;
      hasQueuedDeferredStartupRef.current = false;
      deferredStartupRef.current?.cancel?.();

      try {
        // Critical: Database must be ready first
        let dbInitialized = false;
        let lastInitError: unknown = null;

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await initDatabase();
            dbInitialized = true;
            break;
          } catch (error) {
            lastInitError = error;
            console.error(`Database initialization attempt ${attempt} failed:`, error);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, attempt * 350));
            }
          }
        }

        if (!dbInitialized) {
          throw lastInitError || new Error('Database initialization failed');
        }
        if (cancelled) {
          return;
        }
        setIsDbReady(true);
        dbReadyRef.current = true;

        // Load dark mode preference from DB
        try {
          const { getAppSettings } = await import('./src/database/database');
          const appSettings = await getAppSettings();
          if (!cancelled && appSettings?.themeMode) {
            setThemeMode(appSettings.themeMode);
          } else if (!cancelled && appSettings?.darkModeEnabled) {
            setThemeMode('dark');
          }
        } catch (e) {
          console.warn('Failed to load theme setting:', e);
        }

        // Only await the auth check — it's needed to decide lock screen
        const authEnabled = await isAuthenticationEnabled();
        if (!cancelled) {
          setIsLocked(authEnabled);
        }

        // Brief splash so it doesn't just flash
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 600 - elapsed);
        if (remaining > 0) {
          await new Promise(resolve => setTimeout(resolve, remaining));
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        if (!cancelled) {
          setInitError('تعذر تهيئة قاعدة البيانات. يرجى إعادة المحاولة.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    initializeApp();
    return () => {
      cancelled = true;
    };
  }, [initRunId]);

  useEffect(() => {
    dbReadyRef.current = isDbReady;
  }, [isDbReady]);

  useEffect(() => {
    if (isLoading || !fontsLoaded || !isDbReady || hasQueuedDeferredStartupRef.current) {
      return;
    }

    let cancelled = false;
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    hasQueuedDeferredStartupRef.current = true;

    deferredStartupRef.current = InteractionManager.runAfterInteractions(() => {
      const runDeferredStartup = async () => {
        try {
          await initializeNotifications();
          if (!cancelled) {
            lastNotificationRefreshRef.current = Date.now();
          }
        } catch (e) {
          console.warn('Notifications init skipped:', e);
        }

        if (cancelled) return;
        await wait(120);

        try {
          const { initializeAchievements, checkAllAchievements } = await import('./src/services/achievementService');
          await initializeAchievements();
          await checkAllAchievements();
        } catch (e) {
          console.warn('Achievements init error:', e);
        }

        if (cancelled) return;
        await wait(120);

        try {
          const { initializeWidgetData } = await import('./src/services/widgetDataService');
          await initializeWidgetData();
        } catch (e) {
          console.warn('Widget data init error:', e);
        }
      };

      runDeferredStartup().catch((error) => {
        console.warn('Deferred startup failed:', error);
      });
    });

    return () => {
      cancelled = true;
      deferredStartupRef.current?.cancel?.();
    };
  }, [isLoading, fontsLoaded, isDbReady]);

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

  const SYNC_THROTTLE_MS = 8 * 60 * 60 * 1000; // 8 hours (3 times a day)
  const NOTIFICATION_REFRESH_MS = 6 * 60 * 60 * 1000; // 6 hours

  useEffect(() => {
    let subscription: any;
    let appState = AppState.currentState;

    const checkAuthOnFocus = async () => {
      if (!dbReadyRef.current) {
        return;
      }

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

      // Keep notification scheduling fresh without doing heavy full reschedule every focus.
      try {
        const now = Date.now();
        const shouldRefreshSchedules = now - lastNotificationRefreshRef.current >= NOTIFICATION_REFRESH_MS;
        if (shouldRefreshSchedules) {
          await initializeNotifications();
          lastNotificationRefreshRef.current = now;
        } else {
          await runSmartFinancialAlerts();
        }
      } catch (error) {
        console.error('Error refreshing notifications on focus:', error);
      }

      // Auto-sync when app comes to foreground (Pro only, throttled) – only if user enabled auto-sync
      try {
        const { getAppSettings, upsertAppSettings } = await import('./src/database/database');
        const appSettings = await getAppSettings();
        if (appSettings?.autoSyncEnabled) {
          const now = Date.now();
          const lastSync = appSettings.lastAutoSyncTime || 0;

          if (now - lastSync >= SYNC_THROTTLE_MS) {
            console.log('[Auto-Sync] Triggering sync (8-hour interval)');
            // Update time BEFORE sync to avoid multiple triggers if sync takes time
            await upsertAppSettings({
              ...appSettings,
              lastAutoSyncTime: now
            });

            syncNewToServer().catch((err) => {
              console.error('[Auto-Sync] Sync failed:', err);
            });
          } else {
            const hoursRemaining = ((SYNC_THROTTLE_MS - (now - lastSync)) / (1000 * 60 * 60)).toFixed(1);
            console.log(`[Auto-Sync] Skipped. Next sync in ~${hoursRemaining} hours`);
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

  const handleRetryInitialization = useCallback(() => {
    setInitRunId(prev => prev + 1);
  }, []);

  if (!isVideoFinished) {
    return <VideoSplash onFinish={() => setIsVideoFinished(true)} />;
  }

  if (isLoading || !fontsLoaded || !isDbReady) {
    return (
      <View
        style={styles.loadingContainer}
        onLayout={onLayoutRootView}
      >
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View
        style={styles.loadingContainer}
        onLayout={onLayoutRootView}
      >
        <Text style={styles.errorTitle}>تعذر فتح التطبيق</Text>
        <Text style={styles.errorMessage}>{initError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetryInitialization}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // App lock disabled — LockScreen block commented out
  // if (isLocked) {
  //   return (
  //     <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
  //       <SafeAreaProvider>
  //         <LockScreen onUnlock={handleUnlock} />
  //       </SafeAreaProvider>
  //     </View>
  //   );
  // }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: activeTheme.colors.background }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <PrivacyProvider>
          <ThemeProvider value={{ theme: activeTheme, themeMode, setThemeMode, isDark }}>
            <PaperProvider theme={paperTheme}>
              <Portal.Host>
                <AlertProvider>
                  <PushNotificationManager />
                  <AppNavigator />
                  <StatusBar style={isDark ? "light" : "dark"} backgroundColor={activeTheme.colors.background} />
                </AlertProvider>
              </Portal.Host>
            </PaperProvider>
          </ThemeProvider>
        </PrivacyProvider>
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
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DINNext-Regular',
    marginTop: 20,
  },
  errorTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 8,
    color: '#DDE7F0',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  retryButtonText: {
    color: '#003459',
    fontSize: 14,
    fontWeight: '700',
  },
});
