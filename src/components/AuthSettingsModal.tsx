import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles, type AppTheme } from '../utils/theme';
import { useAuthSettings } from '../hooks/useAuthSettings';
import { convertArabicToEnglishSimple } from '../utils/numbers';
import { AppButton, AppInput, AppDialog } from '../design-system';

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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const {
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
    loadAuthStatus,
    handleSetupPassword,
    handleSetupBiometric,
    handleDisableAuth,
    handleDisablePassword,
    handleDisableBiometric,
    handlePasswordPromptSubmit,
    closePasswordPrompt,
  } = useAuthSettings(onAuthChanged);

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
  }, [visible, loadAuthStatus, slideAnim]);

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
                <AppButton
                  label=""
                  onPress={onClose}
                  variant="ghost"
                  leftIcon="arrow-forward"
                  style={styles.backButton}
                />
                <Text style={styles.title}>إعدادات الأمان</Text>
              </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              {/* Current Status Card */}
              <LinearGradient
                colors={
                  !passwordEnabled && !biometricEnabled
                    ? [theme.colors.textSecondary, theme.colors.textMuted]
                    : passwordEnabled && biometricEnabled
                      ? theme.gradients.primary as any
                      : passwordEnabled
                        ? [theme.colors.info, theme.colors.info]
                        : [theme.colors.success, theme.colors.success]
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
                    <View style={[styles.methodIconContainer, { backgroundColor: theme.colors.info + '20' }]}>
                      <Ionicons name="key" size={24} color={theme.colors.info} />
                    </View>
                    <View style={styles.methodHeaderText}>
                      <Text style={styles.methodTitle}>قفل كلمة المرور</Text>
                      <Text style={styles.methodDescription}>
                        استخدم كلمة مرور قوية لحماية بياناتك
                      </Text>
                    </View>
                  </View>
                  <View style={styles.methodContent}>
                    <AppInput
                      value={password}
                      onChangeText={(v) => setPassword(convertArabicToEnglishSimple(v))}
                      placeholder="كلمة المرور (4 أحرف على الأقل)"
                      secureTextEntry
                      icon="lock-closed"
                      containerStyle={styles.inputSpacing}
                    />
                    <AppInput
                      value={confirmPassword}
                      onChangeText={(v) => setConfirmPassword(convertArabicToEnglishSimple(v))}
                      placeholder="تأكيد كلمة المرور"
                      secureTextEntry
                      icon="lock-closed"
                      containerStyle={styles.inputSpacing}
                    />
                    <AppButton
                      label="تفعيل كلمة المرور"
                      onPress={handleSetupPassword}
                      variant="primary"
                      leftIcon="checkmark-circle"
                      style={styles.setupButton}
                    />
                  </View>
                </View>
              )}

              {/* Biometric Setup */}
              {biometricAvailable && !biometricEnabled && (
                <View style={styles.authMethodCard}>
                  <View style={styles.methodHeader}>
                    <View style={[styles.methodIconContainer, { backgroundColor: theme.colors.success + '20' }]}>
                      <Ionicons
                        name={biometricType.includes('Face') ? 'person' : 'finger-print'}
                        size={24}
                        color={theme.colors.success}
                      />
                    </View>
                    <View style={styles.methodHeaderText}>
                      <Text style={styles.methodTitle}>{biometricType}</Text>
                      <Text style={styles.methodDescription}>
                        فتح سريع وآمن باستخدام {biometricType}
                      </Text>
                    </View>
                  </View>
                  <AppButton
                    label={`تفعيل ${biometricType}`}
                    onPress={handleSetupBiometric}
                    variant="success"
                    leftIcon={biometricType.includes('Face') ? 'person' : 'finger-print'}
                  />
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
                <AppButton
                  label="تعطيل كلمة المرور"
                  onPress={handleDisablePassword}
                  variant="danger"
                  leftIcon="key"
                  style={styles.disableButton}
                />
              )}

              {/* Disable Biometric */}
              {biometricEnabled && (
                <AppButton
                  label={`تعطيل ${biometricType}`}
                  onPress={handleDisableBiometric}
                  variant="danger"
                  leftIcon={biometricType.includes('Face') ? 'person' : 'finger-print'}
                  style={styles.disableButton}
                />
              )}

              {/* Disable All Auth - Show when ANY auth is enabled */}
              {(passwordEnabled || biometricEnabled) && (
                <AppButton
                  label="تعطيل جميع طرق القفل"
                  onPress={handleDisableAuth}
                  variant="danger"
                  leftIcon="lock-open"
                  style={[styles.disableButton, styles.disableAllButton]}
                />
              )}
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Password Prompt Dialog */}
      <AppDialog
        visible={showPasswordPrompt}
        onClose={closePasswordPrompt}
        title="تأكيد الهوية"
        subtitle="يرجى إدخال كلمة المرور للمتابعة"
      >
        <View style={styles.passwordPromptContent}>
          <AppInput
            value={promptPassword}
            onChangeText={(v) => setPromptPassword(convertArabicToEnglishSimple(v))}
            placeholder="كلمة المرور"
            secureTextEntry
            icon="lock-closed"
            containerStyle={styles.passwordPromptInput}
          />
          <View style={styles.passwordPromptActions}>
            <AppButton
              label="إلغاء"
              onPress={closePasswordPrompt}
              variant="secondary"
              style={styles.actionBtnFlex}
            />
            <AppButton
              label="تأكيد"
              onPress={handlePasswordPromptSubmit}
              variant="primary"
              style={styles.actionBtnFlex}
            />
          </View>
        </View>
      </AppDialog>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    marginLeft: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
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
    ...getPlatformShadow('lg'),
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
    backgroundColor: theme.colors.surfaceCard + '33',
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
    color: theme.colors.textInverse + 'E6',
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
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
    ...getPlatformShadow('md'),
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
    fontWeight: getPlatformFontWeight('700'),
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
  inputSpacing: {
    marginBottom: theme.spacing.md,
  },
  setupButton: {
    marginTop: theme.spacing.sm,
  },
  disableButton: {
    marginTop: theme.spacing.md,
  },
  disableAllButton: {
    marginTop: theme.spacing.md,
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
  passwordPromptContent: {
    width: '100%',
  },
  passwordPromptInput: {
    marginBottom: theme.spacing.lg,
  },
  passwordPromptActions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
  },
  actionBtnFlex: {
    flex: 1,
  },
});
