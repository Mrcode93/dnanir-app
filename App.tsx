import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, I18nManager, Platform } from 'react-native';
import { Provider as PaperProvider, Portal, DefaultTheme, configureFonts } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/database';
import { theme } from './src/utils/theme';

const fontConfig = {
  config: {
    regular: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'Cairo-Regular',
      fontWeight: '600' as const,
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
  const [fontsLoaded] = useFonts({
    'Cairo-Regular': require('./assets/fonts/Cairo-Regular.ttf'),
  });

  useEffect(() => {
    try {
      // Force RTL for Arabic app - Always set, don't check
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
      I18nManager.swapLeftAndRightInRTL(true);
      
      // Log current RTL state
      console.log('RTL Status:', {
        isRTL: I18nManager.isRTL,
        allowRTL: I18nManager.allowRTL,
        platform: Platform.OS,
        note: 'App will use RTL layout regardless of I18nManager.isRTL value',
      });
      
      // Note: On iOS, I18nManager.forceRTL() doesn't work dynamically
      // We handle RTL manually in all components using flexDirection: 'row-reverse'
      if (Platform.OS === 'ios' && !I18nManager.isRTL) {
        console.log('ℹ️ iOS: Using manual RTL layout (I18nManager.forceRTL not supported)');
      }
      
      // On Android, need to restart app for RTL to take effect
      if (Platform.OS === 'android' && !I18nManager.isRTL) {
        console.warn('⚠️ Android: RTL not active - App restart required');
      }

      // Set default text styles for RTL
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
      console.error('RTL initialization error:', error);
    }

    const initializeApp = async () => {
      try {
        await initDatabase();
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (isLoading || !fontsLoaded) {
    return (
      <LinearGradient
        colors={[theme.colors.background, theme.colors.backgroundSecondary]}
        style={styles.loadingContainer}
      >
        <Text style={styles.loadingText}>دنانير</Text>
        <Text style={styles.loadingSubtext}>جاري التحميل...</Text>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <Portal.Host>
          <AppNavigator />
          <StatusBar style="dark" backgroundColor={theme.colors.background} />
        </Portal.Host>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  loadingSubtext: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
