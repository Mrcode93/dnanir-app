import { useState, useEffect, useCallback } from 'react';
import { Animated, Platform } from 'react-native';
import {
  authenticateWithBiometric,
  verifyPassword,
  getAuthenticationMethod,
  getBiometricType,
  isBiometricAvailable,
} from '../services/authService';
import { alertService } from '../services/alertService';

import { AUTH_CONSTANTS } from '../constants/authConstants';

const MAX_ATTEMPTS = AUTH_CONSTANTS.MAX_ATTEMPTS;
const BIOMETRIC_DELAY_MS = AUTH_CONSTANTS.BIOMETRIC_DELAY_MS;

export interface UseLockScreenReturn {
  password: string;
  setPassword: (password: string) => void;
  authMethod: 'password' | 'biometric';
  biometricType: string;
  shakeAnim: Animated.Value;
  attempts: number;
  handlePasswordSubmit: () => Promise<void>;
  handleBiometricAuth: () => Promise<void>;
  isLoading: boolean;
}

export const useLockScreen = (onUnlock: () => void): UseLockScreenReturn => {
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'biometric'>('password');
  const [biometricType, setBiometricType] = useState<string>('');
  const [shakeAnim] = useState(new Animated.Value(0));
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadAuthMethod = useCallback(async () => {
    try {
      // On Android, always use password only
      if (Platform.OS === 'android') {
        setAuthMethod('password');
        return;
      }

      const method = await getAuthenticationMethod();
      if (method === 'biometric') {
        const type = await getBiometricType();
        setBiometricType(type);
        setAuthMethod('biometric');
      } else if (method === 'password') {
        setAuthMethod('password');
        // Also check if biometric is available as fallback (iOS only)
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
  }, []);

  const triggerShakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleBiometricAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const success = await authenticateWithBiometric();
      
      if (success) {
        setPassword('');
        setAttempts(0);
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
    } finally {
      setIsLoading(false);
    }
  }, [authMethod, onUnlock]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!password.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      const isValid = await verifyPassword(password);
      if (isValid) {
        setPassword('');
        setAttempts(0);
        onUnlock();
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPassword('');
        
        // Shake animation
        triggerShakeAnimation();

        if (newAttempts >= MAX_ATTEMPTS) {
          alertService.error(
            'تم تجاوز المحاولات',
            `لقد تجاوزت عدد المحاولات المسموح بها (${MAX_ATTEMPTS}). يرجى المحاولة لاحقاً.`
          );
        } else {
          alertService.error(
            'كلمة مرور خاطئة',
            `كلمة المرور غير صحيحة. المحاولات المتبقية: ${MAX_ATTEMPTS - newAttempts}`
          );
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [password, attempts, onUnlock, triggerShakeAnimation]);

  // Initialize auth method on mount
  useEffect(() => {
    loadAuthMethod();
  }, [loadAuthMethod]);

  // Auto-trigger biometric when method is set to biometric (iOS only)
  useEffect(() => {
    // Don't auto-trigger biometric on Android
    if (Platform.OS === 'android') {
      return;
    }

    if (authMethod === 'biometric' && biometricType && !isLoading) {
      // Small delay to ensure UI is ready and biometric prompt can show
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, BIOMETRIC_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [authMethod, biometricType, handleBiometricAuth, isLoading]);

  return {
    password,
    setPassword,
    authMethod,
    biometricType,
    shakeAnim,
    attempts,
    handlePasswordSubmit,
    handleBiometricAuth,
    isLoading,
  };
};
