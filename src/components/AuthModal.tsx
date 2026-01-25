import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { authApiService } from '../services/authApiService';
import { alertService } from '../services/alertService';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = () => {
    setPhone('');
    setPassword('');
    setName('');
    setShowPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    // Validate phone
    if (!phone.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال رقم الهاتف');
      return;
    }

    // Validate password
    if (!password.trim() || password.length < 6) {
      alertService.warning('تنبيه', 'يرجى إدخال كلمة مرور صحيحة (6 أحرف على الأقل)');
      return;
    }

    // Validate name for registration
    if (!isLogin && !name.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال الاسم');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // Login
        const result = await authApiService.login({
          phone: phone.trim(),
          password: password.trim(),
        });

        if (result.success) {
          alertService.success('نجح', 'تم تسجيل الدخول بنجاح');
          handleClose();
          onSuccess?.();
        } else {
          alertService.error('خطأ', result.error || 'فشل تسجيل الدخول');
        }
      } else {
        // Register
        const result = await authApiService.register({
          phone: phone.trim(),
          password: password.trim(),
          name: name.trim(),
        });

        if (result.success) {
          alertService.success('نجح', 'تم إنشاء الحساب بنجاح');
          // Switch to login mode after successful registration
          setIsLogin(true);
          resetForm();
          onSuccess?.();
        } else {
          alertService.error('خطأ', result.error || 'فشل إنشاء الحساب');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء العملية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContainer}
          >
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.modalContent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleClose}
                  style={styles.closeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.textPrimary}
                  />
                </TouchableOpacity>
                <Text style={styles.title}>
                  {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
                </Text>
                <View style={styles.placeholder} />
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Name Input (Registration only) */}
                {!isLogin && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>الاسم</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="أدخل اسمك الكامل"
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.input}
                      autoCapitalize="words"
                      textContentType="name"
                      textAlign={isRTL ? 'right' : 'left'}
                    />
                  </View>
                )}

                {/* Phone Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>رقم الهاتف</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+9647501234567"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                    keyboardType="phone-pad"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    textAlign={isRTL ? 'right' : 'left'}
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>كلمة المرور</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="أدخل كلمة المرور"
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.passwordInput}
                      secureTextEntry={!showPassword}
                      textContentType={isLogin ? 'password' : 'newPassword'}
                      autoComplete={isLogin ? 'password' : 'password-new'}
                      textAlign={isRTL ? 'right' : 'left'}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                  {!isLogin && (
                    <Text style={styles.hint}>
                      يجب أن تكون كلمة المرور 6 أحرف على الأقل
                    </Text>
                  )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  style={styles.submitButton}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.submitButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name={isLogin ? 'log-in' : 'person-add'}
                          size={20}
                          color="#FFFFFF"
                        />
                        <Text style={styles.submitButtonText}>
                          {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Switch Mode */}
                <View style={styles.switchContainer}>
                  <Text style={styles.switchText}>
                    {isLogin
                      ? 'ليس لديك حساب؟'
                      : 'لديك حساب بالفعل؟'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsLogin(!isLogin);
                      resetForm();
                    }}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.switchLink}>
                      {isLogin ? 'إنشاء حساب' : 'تسجيل الدخول'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </LinearGradient>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2,
    position: 'relative',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 450,
    maxHeight: '90%',
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  modalContent: {
    width: '100%',
    minHeight: 400,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    padding: theme.spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  passwordContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  passwordInput: {
    flex: 1,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  eyeButton: {
    padding: theme.spacing.md,
    ...(isRTL ? { marginLeft: theme.spacing.xs } : { marginRight: theme.spacing.xs }),
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    opacity: 0.7,
  },
  submitButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
    ...getPlatformShadow('sm'),
  },
  submitButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  submitButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  switchText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  switchLink: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
});
