import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  setupPassword,
  setupBiometric,
  disableAuthentication,
  disablePassword,
  disableBiometric,
  isBiometricAvailable,
  getBiometricType,
  getAuthenticationMethod,
  isPasswordEnabled,
  isBiometricEnabled,
  authenticateWithBiometric,
  verifyPassword,
} from '../services/authService';
import { alertService } from '../services/alertService';
import { authEventService } from '../services/authEventService';
import { AUTH_CONSTANTS } from '../constants/authConstants';

export interface UseAuthSettingsReturn {
  currentMethod: 'none' | 'password' | 'biometric';
  passwordEnabled: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometricType: string;
  password: string;
  setPassword: (password: string) => void;
  confirmPassword: string;
  setConfirmPassword: (password: string) => void;
  showPasswordPrompt: boolean;
  promptPassword: string;
  setPromptPassword: (password: string) => void;
  isLoading: boolean;
  loadAuthStatus: () => Promise<void>;
  handleSetupPassword: () => Promise<void>;
  handleSetupBiometric: () => Promise<void>;
  handleDisableAuth: () => Promise<void>;
  handleDisablePassword: () => Promise<void>;
  handleDisableBiometric: () => Promise<void>;
  handlePasswordPromptSubmit: () => Promise<void>;
  closePasswordPrompt: () => void;
}

export const useAuthSettings = (onAuthChanged?: () => void): UseAuthSettingsReturn => {
  const [currentMethod, setCurrentMethod] = useState<'none' | 'password' | 'biometric'>('none');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [promptPassword, setPromptPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<((value: boolean) => void) | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const method = await getAuthenticationMethod();
      setCurrentMethod(method);
      
      const passwordStatus = await isPasswordEnabled();
      setPasswordEnabled(passwordStatus);
      
      // On Android, biometric is always disabled
      if (Platform.OS === 'android') {
        setBiometricEnabled(false);
        setBiometricAvailable(false);
      } else {
        const biometricStatus = await isBiometricEnabled();
        setBiometricEnabled(biometricStatus);
        
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);
        
        if (available) {
          const type = await getBiometricType();
          setBiometricType(type);
        }
      }
    } catch (error) {
      console.error('Error loading auth status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const authenticateBeforeDisable = useCallback(async (): Promise<boolean> => {
    try {
      // Try biometric first if enabled
      if (biometricEnabled && biometricAvailable) {
        const success = await authenticateWithBiometric();
        if (success) {
          // Request to keep unlocked after successful biometric
          authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);
          return true;
        }
      }

      // If password is enabled, show password prompt modal
      if (passwordEnabled) {
        return new Promise((resolve) => {
          setPendingAction(() => resolve);
          setShowPasswordPrompt(true);
        });
      }

      // If neither is enabled, allow (shouldn't happen)
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }, [biometricEnabled, biometricAvailable, passwordEnabled]);

  const handleSetupPassword = useCallback(async () => {
    if (!password.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال كلمة مرور');
      return;
    }

    if (password.length < AUTH_CONSTANTS.MIN_PASSWORD_LENGTH) {
      alertService.warning('تنبيه', 'كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      alertService.warning('تنبيه', 'كلمات المرور غير متطابقة');
      return;
    }

    setIsLoading(true);
    try {
      const success = await setupPassword(password);
      if (success) {
        alertService.success('نجح', 'تم تفعيل قفل كلمة المرور بنجاح');
        setPassword('');
        setConfirmPassword('');
        onAuthChanged?.();
        await loadAuthStatus();
      } else {
        alertService.error('خطأ', 'حدث خطأ أثناء إعداد كلمة المرور');
      }
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, onAuthChanged, loadAuthStatus]);

  const handleSetupBiometric = useCallback(async () => {
    if (!biometricAvailable) {
      alertService.warning('غير متاح', 'المصادقة البيومترية غير متاحة على هذا الجهاز');
      return;
    }

    setIsLoading(true);
    try {
      // First test the biometric authentication
      const testResult = await authenticateWithBiometric();
      
      if (!testResult) {
        alertService.error('فشل المصادقة', 'لم يتم التحقق من المصادقة البيومترية. يرجى المحاولة مرة أخرى.');
        return;
      }

      // If test passes, save the settings
      const success = await setupBiometric();
      if (success) {
        alertService.success('نجح', `تم تفعيل ${biometricType} بنجاح`);
        onAuthChanged?.();
        await loadAuthStatus();
      } else {
        alertService.error('خطأ', 'حدث خطأ أثناء إعداد المصادقة البيومترية');
      }
    } catch (error) {
      console.error('Biometric test error:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء اختبار المصادقة البيومترية');
    } finally {
      setIsLoading(false);
    }
  }, [biometricAvailable, biometricType, onAuthChanged, loadAuthStatus]);

  const handleDisableAuth = useCallback(async () => {
    // Request to keep app unlocked during this operation
    authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);
    
    // Authenticate before allowing disable
    const authenticated = await authenticateBeforeDisable();
    if (!authenticated) {
      return;
    }
    
    // Ensure app stays unlocked after authentication
    authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);

    alertService.confirm(
      'تعطيل القفل',
      'هل أنت متأكد من تعطيل القفل؟',
      async () => {
        setIsLoading(true);
        try {
          await disableAuthentication();
          
          // Wait for database to commit
          await new Promise(resolve => setTimeout(resolve, AUTH_CONSTANTS.DATABASE_COMMIT_DELAY_MS));
          
          // Verify the change was saved
          const authMethod = await getAuthenticationMethod();
          if (authMethod !== 'none') {
            alertService.error('خطأ', 'فشل تعطيل القفل. يرجى المحاولة مرة أخرى.');
            return;
          }
          
          // Notify App.tsx that authentication has changed
          authEventService.notifyAuthChanged();
          
          alertService.success('نجح', 'تم تعطيل القفل بنجاح');
          onAuthChanged?.();
          await loadAuthStatus();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
          alertService.error('خطأ', `حدث خطأ أثناء تعطيل القفل: ${errorMessage}`);
        } finally {
          setIsLoading(false);
        }
      }
    );
  }, [authenticateBeforeDisable, onAuthChanged, loadAuthStatus]);

  const handleDisablePassword = useCallback(async () => {
    authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);
    
    const authenticated = await authenticateBeforeDisable();
    if (!authenticated) {
      return;
    }

    authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);

    alertService.confirm(
      'تعطيل كلمة المرور',
      'هل أنت متأكد من تعطيل قفل كلمة المرور؟',
      async () => {
        setIsLoading(true);
        try {
          await disablePassword();
          
          const authMethod = await getAuthenticationMethod();
          if (authMethod === 'none') {
            authEventService.notifyAuthChanged();
          }
          
          alertService.success('نجح', 'تم تعطيل قفل كلمة المرور بنجاح');
          onAuthChanged?.();
          await loadAuthStatus();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
          alertService.error('خطأ', `حدث خطأ أثناء تعطيل كلمة المرور: ${errorMessage}`);
        } finally {
          setIsLoading(false);
        }
      }
    );
  }, [authenticateBeforeDisable, onAuthChanged, loadAuthStatus]);

  const handleDisableBiometric = useCallback(async () => {
    authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);
    
    const authenticated = await authenticateBeforeDisable();
    if (!authenticated) {
      return;
    }

    authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);

    alertService.confirm(
      `تعطيل ${biometricType}`,
      `هل أنت متأكد من تعطيل ${biometricType}؟`,
      async () => {
        setIsLoading(true);
        try {
          await disableBiometric();
          
          const authMethod = await getAuthenticationMethod();
          if (authMethod === 'none') {
            authEventService.notifyAuthChanged();
          }
          
          alertService.success('نجح', `تم تعطيل ${biometricType} بنجاح`);
          onAuthChanged?.();
          await loadAuthStatus();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
          alertService.error('خطأ', `حدث خطأ أثناء تعطيل ${biometricType}: ${errorMessage}`);
        } finally {
          setIsLoading(false);
        }
      }
    );
  }, [biometricType, authenticateBeforeDisable, onAuthChanged, loadAuthStatus]);

  const handlePasswordPromptSubmit = useCallback(async () => {
    if (!promptPassword.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    try {
      const isValid = await verifyPassword(promptPassword);
      if (isValid) {
        // Request to keep unlocked after successful password verification
        authEventService.requestKeepUnlocked(AUTH_CONSTANTS.KEEP_UNLOCKED_DURATION_MS);
        setPromptPassword('');
        setShowPasswordPrompt(false);
        if (pendingAction) {
          pendingAction(true);
          setPendingAction(null);
        }
      } else {
        alertService.error('خطأ', 'كلمة المرور غير صحيحة');
        setPromptPassword('');
      }
    } finally {
      setIsLoading(false);
    }
  }, [promptPassword, pendingAction]);

  const closePasswordPrompt = useCallback(() => {
    setShowPasswordPrompt(false);
    setPromptPassword('');
    if (pendingAction) {
      pendingAction(false);
      setPendingAction(null);
    }
  }, [pendingAction]);

  // Load auth status on mount
  useEffect(() => {
    loadAuthStatus();
  }, [loadAuthStatus]);

  return {
    currentMethod,
    passwordEnabled,
    biometricEnabled,
    biometricAvailable,
    biometricType,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPasswordPrompt,
    promptPassword,
    setPromptPassword,
    isLoading,
    loadAuthStatus,
    handleSetupPassword,
    handleSetupBiometric,
    handleDisableAuth,
    handleDisablePassword,
    handleDisableBiometric,
    handlePasswordPromptSubmit,
    closePasswordPrompt,
  };
};
