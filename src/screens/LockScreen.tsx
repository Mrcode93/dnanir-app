import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { authenticateWithBiometric, verifyPassword, getAuthenticationMethod, getBiometricType, isBiometricAvailable } from '../services/authService';
import { alertService } from '../services/alertService';

interface LockScreenProps {
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'biometric'>('password');
  const [biometricType, setBiometricType] = useState<string>('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 5;

  useEffect(() => {
    const initialize = async () => {
      await loadAuthMethod();
    };
    initialize();
  }, []);

  // Auto-trigger biometric when method is set to biometric
  useEffect(() => {
    if (authMethod === 'biometric' && biometricType) {
      // Small delay to ensure UI is ready and biometric prompt can show
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [authMethod, biometricType]);

  const loadAuthMethod = async () => {
    try {
      const method = await getAuthenticationMethod();
      if (method === 'biometric') {
        const type = await getBiometricType();
        setBiometricType(type);
        setAuthMethod('biometric');
      } else if (method === 'password') {
        setAuthMethod('password');
        // Also check if biometric is available as fallback
        const available = await isBiometricAvailable();
        if (available) {
          const type = await getBiometricType();
          setBiometricType(type);
        }
      } else {
        setAuthMethod('password');
      }
    } catch (error) {
      console.error('Error loading auth method:', error);
      setAuthMethod('password');
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const success = await authenticateWithBiometric();
      
      if (success) {
        // Call onUnlock immediately when biometric succeeds
        onUnlock();
      } else {
        // If biometric fails, show password option
        if (authMethod === 'biometric') {
          // Allow fallback to password if biometric is set but fails
          const method = await getAuthenticationMethod();
          if (method === 'password' || method === 'biometric') {
            setAuthMethod('password');
          }
        }
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      // Fallback to password on error
      const method = await getAuthenticationMethod();
      if (method === 'password' || method === 'biometric') {
        setAuthMethod('password');
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال كلمة المرور');
      return;
    }

    const isValid = await verifyPassword(password);
    if (isValid) {
      setPassword('');
      setAttempts(0);
      onUnlock();
    } else {
      setAttempts(attempts + 1);
      setPassword('');
      
      // Shake animation
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();

      if (attempts + 1 >= maxAttempts) {
        alertService.error(
          'تم تجاوز المحاولات',
          `لقد تجاوزت عدد المحاولات المسموح بها (${maxAttempts}). يرجى المحاولة لاحقاً.`
        );
      } else {
        alertService.error(
          'كلمة مرور خاطئة',
          `كلمة المرور غير صحيحة. المحاولات المتبقية: ${maxAttempts - attempts - 1}`
        );
      }
    }
  };

  const translateX = shakeAnim;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[theme.colors.primary, '#2563EB', '#1D4ED8']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

            {authMethod === 'password' && (
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
    fontWeight: '700',
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
    fontWeight: '600',
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
