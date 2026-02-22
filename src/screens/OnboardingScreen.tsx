import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useThemedStyles, useAppTheme } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { onboardingStorage } from '../services/onboardingStorage';

const { width, height } = Dimensions.get('window');

type OnboardingScreenProps = {
  navigation: any;
  onFinish?: () => void;
};

export const OnboardingScreen = ({ navigation, onFinish }: OnboardingScreenProps) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [isCompleting, setIsCompleting] = useState(false);

  const navigateToAuth = useCallback((isLogin: boolean = true) => {
    navigation.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'Auth', params: { isLogin } }],
    });
  }, [navigation]);

  const navigateToMain = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }, [navigation]);

  const handleStart = useCallback(async (mode: 'register' | 'login' | 'skip') => {
    if (isCompleting) return;
    setIsCompleting(true);

    await onboardingStorage.setHasSeenOnboarding(true);
    onFinish?.();

    if (mode === 'skip') {
      navigateToMain();
    } else {
      navigateToAuth(mode === 'login');
    }
  }, [isCompleting, navigateToAuth, navigateToMain, onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#0B5A7A', '#084B68', '#053C56']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Top Section: Logo & Illustration */}
          <View style={styles.topSection}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/letters-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View style={styles.illustrationContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="wallet-outline" size={80} color="#FFFFFF" />
              </View>
              {/* Decorative elements */}
              <View style={[styles.decorDot, { top: 20, right: -10, width: 12, height: 12, opacity: 0.6 }]} />
              <View style={[styles.decorDot, { bottom: 40, left: -20, width: 20, height: 20, opacity: 0.4 }]} />
              <View style={[styles.decorDot, { top: 60, left: 10, width: 8, height: 8, opacity: 0.8 }]} />
            </View>
          </View>

          {/* Middle Section: Welcome Text */}
          <View style={styles.textSection}>
            <Text style={styles.title}>مرحباً بك في دنانير</Text>
            <Text style={styles.subtitle}>
              تحكّم بأموالك بطريقة ذكية وسهلة. تابع مصروفاتك، افهم دخلك، وحقق أهدافك المالية بثقة وأمان.
            </Text>
          </View>

          {/* Bottom Section: Action Buttons */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleStart('register')}
              disabled={isCompleting}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonText}>إنشاء حساب جديد</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleStart('login')}
              disabled={isCompleting}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>تسجيل الدخول</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => handleStart('skip')}
              disabled={isCompleting}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText}>التخطي والاستمرار كضيف</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>بذكاء، تدير دنانير حياتك المالية</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0B5A7A',
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 30,
      justifyContent: 'space-between',
      paddingTop: 40,
      paddingBottom: 20,
    },
    topSection: {
      alignItems: 'center',
    },
    logoWrapper: {
      marginBottom: 40,
    },
    logo: {
      width: 160,
      height: 60,
      tintColor: '#FFFFFF', // Assuming logo can be tinted or use white version
    },
    illustrationContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      ...getPlatformShadow('lg'),
    },
    decorDot: {
      position: 'absolute',
      backgroundColor: '#FFFFFF',
      borderRadius: 999,
    },
    textSection: {
      alignItems: 'center',
      marginVertical: 40,
    },
    title: {
      fontFamily: theme.typography.fontFamily,
      fontSize: 32,
      fontWeight: getPlatformFontWeight('800'),
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 16,
    },
    subtitle: {
      fontFamily: theme.typography.fontFamily,
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.85)',
      textAlign: 'center',
      lineHeight: 26,
      paddingHorizontal: 10,
    },
    buttonSection: {
      width: '100%',
      gap: 14,
    },
    primaryButton: {
      backgroundColor: '#FFFFFF',
      height: 58,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      ...getPlatformShadow('md'),
    },
    primaryButtonText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: 18,
      fontWeight: getPlatformFontWeight('700'),
      color: '#0B5A7A',
    },
    secondaryButton: {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      height: 58,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    secondaryButtonText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: 18,
      fontWeight: getPlatformFontWeight('600'),
      color: '#FFFFFF',
    },
    skipButton: {
      marginTop: 6,
      paddingVertical: 10,
      alignItems: 'center',
    },
    skipButtonText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: 15,
      color: 'rgba(255, 255, 255, 0.7)',
      fontWeight: getPlatformFontWeight('600'),
      textDecorationLine: 'underline',
    },
    footer: {
      paddingBottom: 20,
      alignItems: 'center',
    },
    footerText: {
      fontFamily: theme.typography.fontFamily,
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.4)',
      letterSpacing: 0.5,
    },
  });
