import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
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

interface AuthSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onAuthChanged: () => void;
}

export const AuthSettingsModal: React.FC<AuthSettingsModalProps> = ({
  visible,
  onClose,
  onAuthChanged,
}) => {
  const insets = useSafeAreaInsets();
  const [currentMethod, setCurrentMethod] = useState<'none' | 'password' | 'biometric'>('none');
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [slideAnim] = useState(new Animated.Value(0));
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [promptPassword, setPromptPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<((value: boolean) => void) | null>(null);

  useEffect(() => {
    if (visible) {
      loadAuthStatus();
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const loadAuthStatus = async () => {
    const method = await getAuthenticationMethod();
    setCurrentMethod(method);
    
    const passwordStatus = await isPasswordEnabled();
    setPasswordEnabled(passwordStatus);
    
    const biometricStatus = await isBiometricEnabled();
    setBiometricEnabled(biometricStatus);
    
    const available = await isBiometricAvailable();
    setBiometricAvailable(available);
    
    if (available) {
      const type = await getBiometricType();
      setBiometricType(type);
    }
  };

  const handleSetupPassword = async () => {
    if (!password.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال كلمة مرور');
      return;
    }

    if (password.length < 4) {
      alertService.warning('تنبيه', 'كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      alertService.warning('تنبيه', 'كلمات المرور غير متطابقة');
      return;
    }

    const success = await setupPassword(password);
    if (success) {
      alertService.success('نجح', 'تم تفعيل قفل كلمة المرور بنجاح');
      setPassword('');
      setConfirmPassword('');
      onAuthChanged();
      loadAuthStatus();
    } else {
      alertService.error('خطأ', 'حدث خطأ أثناء إعداد كلمة المرور');
    }
  };

  const handleSetupBiometric = async () => {
    if (!biometricAvailable) {
      alertService.warning('غير متاح', 'المصادقة البيومترية غير متاحة على هذا الجهاز');
      return;
    }

    // First test the biometric authentication
    try {
      const { authenticateWithBiometric } = await import('../services/authService');
      const testResult = await authenticateWithBiometric();
      
      if (!testResult) {
        alertService.error('فشل المصادقة', 'لم يتم التحقق من المصادقة البيومترية. يرجى المحاولة مرة أخرى.');
        return;
      }
    } catch (error) {
      console.error('Biometric test error:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء اختبار المصادقة البيومترية');
      return;
    }

    // If test passes, save the settings
    const success = await setupBiometric();
    if (success) {
      alertService.success('نجح', `تم تفعيل ${biometricType} بنجاح`);
      onAuthChanged();
      loadAuthStatus();
    } else {
      alertService.error('خطأ', 'حدث خطأ أثناء إعداد المصادقة البيومترية');
    }
  };

  const handleDisableAuth = async () => {
    // Request to keep app unlocked during this operation (60 seconds should be enough)
    authEventService.requestKeepUnlocked(60000);
    
    // Authenticate before allowing disable
    const authenticated = await authenticateBeforeDisable();
    if (!authenticated) {
      return;
    }
    
    // Ensure app stays unlocked after authentication
    authEventService.requestKeepUnlocked(60000);

    alertService.confirm(
      'تعطيل القفل',
      'هل أنت متأكد من تعطيل القفل؟',
      async () => {
        try {
        await disableAuthentication();
          
          // Wait for database to commit
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify the change was saved
          const authMethod = await getAuthenticationMethod();
          if (authMethod !== 'none') {
            alertService.error('خطأ', 'فشل تعطيل القفل. يرجى المحاولة مرة أخرى.');
            return;
          }
          
          // Notify App.tsx that authentication has changed
          authEventService.notifyAuthChanged();
          
          alertService.success('نجح', 'تم تعطيل القفل بنجاح');
        onAuthChanged();
        loadAuthStatus();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
          alertService.error('خطأ', `حدث خطأ أثناء تعطيل القفل: ${errorMessage}`);
        }
      }
    );
  };

  const handleDisablePassword = async () => {
    authEventService.requestKeepUnlocked(60000);
    
    const authenticated = await authenticateBeforeDisable();
    if (!authenticated) {
      return;
    }

    authEventService.requestKeepUnlocked(60000);

    alertService.confirm(
      'تعطيل كلمة المرور',
      'هل أنت متأكد من تعطيل قفل كلمة المرور؟',
      async () => {
        try {
        await disablePassword();
          
          const authMethod = await getAuthenticationMethod();
          if (authMethod === 'none') {
            authEventService.notifyAuthChanged();
          }
          
          alertService.success('نجح', 'تم تعطيل قفل كلمة المرور بنجاح');
        onAuthChanged();
        loadAuthStatus();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
          alertService.error('خطأ', `حدث خطأ أثناء تعطيل كلمة المرور: ${errorMessage}`);
        }
      }
    );
  };

  const handleDisableBiometric = async () => {
    authEventService.requestKeepUnlocked(60000);
    
    const authenticated = await authenticateBeforeDisable();
    if (!authenticated) {
      return;
    }

    authEventService.requestKeepUnlocked(60000);

    alertService.confirm(
      `تعطيل ${biometricType}`,
      `هل أنت متأكد من تعطيل ${biometricType}؟`,
      async () => {
        try {
        await disableBiometric();
          
          const authMethod = await getAuthenticationMethod();
          if (authMethod === 'none') {
            authEventService.notifyAuthChanged();
          }
          
          alertService.success('نجح', `تم تعطيل ${biometricType} بنجاح`);
        onAuthChanged();
        loadAuthStatus();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'حدث خطأ غير متوقع';
          alertService.error('خطأ', `حدث خطأ أثناء تعطيل ${biometricType}: ${errorMessage}`);
        }
      }
    );
  };

  const authenticateBeforeDisable = async (): Promise<boolean> => {
    try {
      // Try biometric first if enabled
      if (biometricEnabled && biometricAvailable) {
        const success = await authenticateWithBiometric();
        if (success) {
          // Request to keep unlocked after successful biometric
          authEventService.requestKeepUnlocked(60000);
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
  };

  const handlePasswordPromptSubmit = async () => {
    if (!promptPassword.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال كلمة المرور');
      return;
    }

    const isValid = await verifyPassword(promptPassword);
    if (isValid) {
      // Request to keep unlocked after successful password verification
      authEventService.requestKeepUnlocked(60000);
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
  };

  const opacityAnim = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              paddingTop: insets.top,
              paddingBottom: insets.bottom + theme.spacing.md,
            },
          ]}
        >
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.modalGradient}
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={onClose} style={styles.backButton}>
                  <Ionicons name="arrow-forward" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>إعدادات الأمان</Text>
              </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {/* Current Status Card */}
              <LinearGradient
                colors={
                  !passwordEnabled && !biometricEnabled
                    ? ['#6B7280', '#4B5563']
                    : passwordEnabled && biometricEnabled
                    ? ['#8B5CF6', '#7C3AED']
                    : passwordEnabled
                    ? ['#3B82F6', '#2563EB']
                    : ['#10B981', '#059669']
                }
                style={styles.statusCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.statusCardContent}>
                  <View style={styles.statusIconContainer}>
                    {passwordEnabled && biometricEnabled ? (
                      <View style={styles.dualIconContainer}>
                        <Ionicons name="key" size={20} color="#FFFFFF" />
                        <Ionicons
                          name={biometricType.includes('Face') ? 'person' : 'finger-print'}
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>
                    ) : (
                      <Ionicons
                        name={
                          !passwordEnabled && !biometricEnabled
                            ? 'lock-open'
                            : passwordEnabled
                            ? 'key'
                            : biometricType.includes('Face')
                            ? 'person'
                            : 'finger-print'
                        }
                        size={32}
                        color="#FFFFFF"
                      />
                    )}
                  </View>
                  <View style={styles.statusTextContainer}>
                    <Text style={styles.statusTitle}>الحالة الحالية</Text>
                    <Text style={styles.statusText}>
                      {!passwordEnabled && !biometricEnabled
                        ? 'القفل غير مفعل'
                        : passwordEnabled && biometricEnabled
                        ? `كلمة المرور و ${biometricType} مفعلان`
                        : passwordEnabled
                        ? 'قفل كلمة المرور مفعل'
                        : `${biometricType} مفعل`}
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Password Setup */}
              {!passwordEnabled && (
                <View style={styles.authMethodCard}>
                  <View style={styles.methodHeader}>
                    <View style={[styles.methodIconContainer, { backgroundColor: '#3B82F620' }]}>
                      <Ionicons name="key" size={24} color="#3B82F6" />
                    </View>
                    <View style={styles.methodHeaderText}>
                      <Text style={styles.methodTitle}>قفل كلمة المرور</Text>
                      <Text style={styles.methodDescription}>
                        استخدم كلمة مرور قوية لحماية بياناتك
                      </Text>
                    </View>
                  </View>
                  <View style={styles.methodContent}>
                    <View style={styles.inputContainer}>
                      <Ionicons name="lock-closed" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="كلمة المرور (4 أحرف على الأقل)"
                        secureTextEntry
                        style={styles.input}
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                    <View style={styles.inputContainer}>
                      <Ionicons name="lock-closed" size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="تأكيد كلمة المرور"
                        secureTextEntry
                        style={styles.input}
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={handleSetupPassword}
                      style={styles.setupButton}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#3B82F6', '#2563EB']}
                        style={styles.setupButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.setupButtonText}>تفعيل كلمة المرور</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Biometric Setup */}
              {biometricAvailable && !biometricEnabled && (
                <View style={styles.authMethodCard}>
                  <View style={styles.methodHeader}>
                    <View style={[styles.methodIconContainer, { backgroundColor: '#10B98120' }]}>
                      <Ionicons
                        name={biometricType.includes('Face') ? 'person' : 'finger-print'}
                        size={24}
                        color="#10B981"
                      />
                    </View>
                    <View style={styles.methodHeaderText}>
                      <Text style={styles.methodTitle}>{biometricType}</Text>
                      <Text style={styles.methodDescription}>
                        فتح سريع وآمن باستخدام {biometricType}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleSetupBiometric}
                    style={styles.biometricButton}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.biometricButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons
                        name={biometricType.includes('Face') ? 'person' : 'finger-print'}
                        size={28}
                        color="#FFFFFF"
                      />
                      <Text style={styles.biometricButtonText}>
                        تفعيل {biometricType}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Info Section */}
              {(passwordEnabled || biometricEnabled) && (
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
                  <Text style={styles.infoText}>
                    {passwordEnabled && biometricEnabled
                      ? `سيتم طلب ${biometricType} أو كلمة المرور عند فتح التطبيق`
                      : passwordEnabled
                      ? 'سيتم طلب كلمة المرور عند فتح التطبيق'
                      : `سيتم طلب ${biometricType} عند فتح التطبيق`}
                  </Text>
                </View>
              )}

              {/* Disable Password */}
              {passwordEnabled && (
                <TouchableOpacity
                  onPress={handleDisablePassword}
                  style={styles.disableButton}
                  activeOpacity={0.8}
                >
                  <View style={styles.disableButtonContent}>
                    <View style={styles.disableIconContainer}>
                      <Ionicons name="key" size={24} color="#EF4444" />
                    </View>
                    <View style={styles.disableButtonTextContainer}>
                      <Text style={styles.disableButtonTitle}>تعطيل كلمة المرور</Text>
                      <Text style={styles.disableButtonDescription}>
                        إزالة قفل كلمة المرور
                      </Text>
                    </View>
                    <Ionicons name="chevron-back" size={20} color="#EF4444" />
                  </View>
                </TouchableOpacity>
              )}

              {/* Disable Biometric */}
              {biometricEnabled && (
                <TouchableOpacity
                  onPress={handleDisableBiometric}
                  style={styles.disableButton}
                  activeOpacity={0.8}
                >
                  <View style={styles.disableButtonContent}>
                    <View style={styles.disableIconContainer}>
                      <Ionicons
                        name={biometricType.includes('Face') ? 'person' : 'finger-print'}
                        size={24}
                        color="#EF4444"
                      />
                    </View>
                    <View style={styles.disableButtonTextContainer}>
                      <Text style={styles.disableButtonTitle}>تعطيل {biometricType}</Text>
                      <Text style={styles.disableButtonDescription}>
                        إزالة {biometricType}
                      </Text>
                    </View>
                    <Ionicons name="chevron-back" size={20} color="#EF4444" />
                  </View>
                </TouchableOpacity>
              )}

              {/* Disable All Auth - Show when ANY auth is enabled */}
              {(passwordEnabled || biometricEnabled) && (
                <TouchableOpacity
                  onPress={handleDisableAuth}
                  style={[styles.disableButton, styles.disableAllButton]}
                  activeOpacity={0.8}
                >
                  <View style={styles.disableButtonContent}>
                    <View style={styles.disableIconContainer}>
                      <Ionicons name="lock-open" size={24} color="#EF4444" />
                    </View>
                    <View style={styles.disableButtonTextContainer}>
                      <Text style={styles.disableButtonTitle}>تعطيل جميع طرق القفل</Text>
                      <Text style={styles.disableButtonDescription}>
                        إزالة جميع الحماية من التطبيق
                      </Text>
                    </View>
                    <Ionicons name="chevron-back" size={20} color="#EF4444" />
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Password Prompt Modal */}
      <Modal
        visible={showPasswordPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPasswordPrompt(false);
          setPromptPassword('');
          if (pendingAction) {
            pendingAction(false);
            setPendingAction(null);
          }
        }}
      >
        <View style={styles.passwordPromptOverlay}>
          <View style={styles.passwordPromptContainer}>
            <Text style={styles.passwordPromptTitle}>تأكيد الهوية</Text>
            <Text style={styles.passwordPromptMessage}>
              يرجى إدخال كلمة المرور للمتابعة
            </Text>
            <View style={styles.passwordPromptInputContainer}>
              <Ionicons name="lock-closed" size={20} color={theme.colors.textSecondary} style={styles.passwordPromptIcon} />
              <TextInput
                value={promptPassword}
                onChangeText={setPromptPassword}
                placeholder="كلمة المرور"
                secureTextEntry
                style={styles.passwordPromptInput}
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus
                onSubmitEditing={handlePasswordPromptSubmit}
              />
            </View>
            <View style={styles.passwordPromptActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordPrompt(false);
                  setPromptPassword('');
                  if (pendingAction) {
                    pendingAction(false);
                    setPendingAction(null);
                  }
                }}
                style={styles.passwordPromptCancelButton}
              >
                <Text style={styles.passwordPromptCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePasswordPromptSubmit}
                style={styles.passwordPromptConfirmButton}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  style={styles.passwordPromptConfirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.passwordPromptConfirmText}>تأكيد</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalContainer: {
    flex: 1,
    width: '100%',
  },
  modalGradient: {
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
  },
  headerLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginLeft: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  statusCard: {
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  statusCardContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  statusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  dualIconContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  authMethodCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.md,
  },
  methodHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  methodHeaderText: {
    flex: 1,
  },
  methodTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  methodDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  methodContent: {
    marginTop: theme.spacing.md,
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  inputIcon: {
    marginLeft: theme.spacing.sm,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    flex: 1,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  setupButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
  },
  setupButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  setupButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  biometricButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  biometricButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  biometricButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  disableButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: theme.spacing.md,
    ...theme.shadows.sm,
  },
  disableButtonContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  disableIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.md,
  },
  disableButtonTextContainer: {
    flex: 1,
  },
  disableButtonTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  disableButtonDescription: {
    fontSize: theme.typography.sizes.sm,
    color: '#DC2626',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  disableAllButton: {
    marginTop: theme.spacing.md,
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  infoCard: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.primary + '10',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
  },
  infoText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 20,
  },
  passwordPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  passwordPromptContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.lg,
  },
  passwordPromptTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    writingDirection: 'rtl',
  },
  passwordPromptMessage: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    writingDirection: 'rtl',
  },
  passwordPromptInputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  passwordPromptIcon: {
    marginLeft: theme.spacing.sm,
  },
  passwordPromptInput: {
    flex: 1,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  passwordPromptActions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
  },
  passwordPromptCancelButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  passwordPromptCancelText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  passwordPromptConfirmButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  passwordPromptConfirmGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  passwordPromptConfirmText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
});
