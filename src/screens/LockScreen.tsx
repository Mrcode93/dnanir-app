import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform as RNPlatform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformFontWeight } from '../utils/theme';
import { useLockScreen } from '../hooks/useLockScreen';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const {
    password,
    setPassword,
    authMethod,
    biometricType,
    shakeAnim,
    handlePasswordSubmit,
    handleBiometricAuth,
  } = useLockScreen(onUnlock);

  const translateX = shakeAnim;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[theme.colors.primary, '#2563EB', '#1D4ED8']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={RNPlatform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.lockIcon}>
                <Ionicons name="lock-closed" size={48} color={theme.colors.textInverse} />
              </View>
            </View>

            <Text style={styles.title}>التطبيق محمي</Text>
            <Text style={styles.subtitle}>
              {authMethod === 'biometric'
                ? `استخدم ${biometricType} للفتح`
                : 'أدخل كلمة المرور للفتح'}
            </Text>

            {authMethod === 'password' && (
              <Animated.View style={[styles.inputContainer, { transform: [{ translateX }] }]}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="كلمة المرور"
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry
                  style={styles.input}
                  autoFocus
                  onSubmitEditing={handlePasswordSubmit}
                />
                <TouchableOpacity
                  onPress={handlePasswordSubmit}
                  style={styles.submitButton}
                >
                  <Ionicons name="arrow-forward" size={24} color={theme.colors.textInverse} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {authMethod === 'biometric' && (
              <TouchableOpacity
                onPress={handleBiometricAuth}
                style={styles.biometricButton}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
                  style={styles.biometricButtonGradient}
                >
                  <Ionicons
                    name={biometricType.includes('Face') ? 'person' : 'finger-print'}
                    size={48}
                    color={theme.colors.textInverse}
                  />
                  <Text style={styles.biometricButtonText}>
                    اضغط للمصادقة بـ {biometricType}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {authMethod === 'password' && biometricType && RNPlatform.OS !== 'android' && (
              <TouchableOpacity
                onPress={handleBiometricAuth}
                style={styles.biometricFallback}
              >
                <Ionicons
                  name={biometricType.includes('Face') ? 'person' : 'finger-print'}
                  size={24}
                  color={theme.colors.textInverse}
                />
                <Text style={styles.biometricFallbackText}>
                  أو استخدم {biometricType}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  lockIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: theme.spacing.xl,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  input: {
    flex: 1,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    paddingVertical: theme.spacing.sm,
  },
  submitButton: {
    padding: theme.spacing.sm,
  },
  biometricButton: {
    width: '100%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  biometricButtonGradient: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  biometricButtonText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textInverse,
    marginTop: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  biometricFallback: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  biometricFallbackText: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
  },
});
