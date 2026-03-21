import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Dimensions, Image, Modal, Keyboard, InteractionManager, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { authApiService } from '../services/authApiService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, convertArabicToEnglishSimple } from '../utils/numbers';
import { COUNTRIES } from '../constants/countries';
import { tl, useLocalization } from "../localization";
const {
  width
} = Dimensions.get('window');
interface AuthModalProps {
  visible: boolean;
  isLogin?: boolean;
  onSuccess?: (user?: any) => void;
  onClose: () => void;
}
export const AuthScreen = ({
  visible,
  isLogin: isLoginProp = true,
  onSuccess,
  onClose
}: AuthModalProps) => {
  useLocalization();
  const {
    theme,
    isDark
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const otpInputRef = React.useRef<TextInput>(null);
  const [isLogin, setIsLogin] = useState(isLoginProp);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState('IQ');
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<'phone' | 'otp' | 'reset'>('phone');
  const [forgotOtp, setForgotOtp] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Reset form state every time the modal opens
  useEffect(() => {
    if (visible) {
      setIsLogin(isLoginProp);
      setPhone('');
      setPassword('');
      setName('');
      setReferralCode('');
      setOtpCode('');
      setOtpVisible(false);
      setIsForgotMode(false);
      setForgotStep('phone');
      setForgotOtp('');
      setConfirmPassword('');
      setLocalError(null);
    }
  }, [visible]);

  // Start countdown when OTP modal opens
  useEffect(() => {
    if (otpVisible) {
      setResendCountdown(60);
    } else {
      setResendCountdown(0);
      if (resendTimerRef.current) {
        clearInterval(resendTimerRef.current);
        resendTimerRef.current = null;
      }
    }
  }, [otpVisible]);

  // Tick countdown
  useEffect(() => {
    if (resendCountdown > 0) {
      resendTimerRef.current = setInterval(() => {
        setResendCountdown(prev => {
          if (prev <= 1) {
            if (resendTimerRef.current) clearInterval(resendTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      };
    }
  }, [resendCountdown > 0]);
  const countries = COUNTRIES;
  const [searchQuery, setSearchQuery] = useState('');
  const filteredCountries = countries.filter(c => c.name.includes(searchQuery) || c.dial.includes(searchQuery) || c.code.toLowerCase().includes(searchQuery.toLowerCase()));
  const showError = (error: string | undefined, fallback: string) => {
    if (error === 'MAINTENANCE_MODE') return;
    const msg = error || fallback;
    setLocalError(msg);

    // Use native Alert as fallback because CustomAlert (Modal) might be blocked by AuthScreen (Modal)
    Alert.alert(tl("خطأ"), msg);
  };
  const handleSubmit = async () => {
    Keyboard.dismiss();
    setLocalError(null);
    // ── Forgot password: step 1 — send OTP ──
    if (isForgotMode && forgotStep === 'phone') {
      if (!phone.trim()) {
        alertService.warning(tl("تنبيه"), tl("يرجى إدخال رقم الهاتف"));
        return;
      }
      handleForgotSendOtp();
      return;
    }

    // ── Forgot password: step 2 — verify OTP ──
    if (isForgotMode && forgotStep === 'otp') {
      handleForgotVerifyOtp();
      return;
    }

    // ── Forgot password: step 3 — reset password ──
    if (isForgotMode && forgotStep === 'reset') {
      handleForgotReset();
      return;
    }

    // ── Login ──
    if (!phone.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال رقم الهاتف"));
      return;
    }
    if (!password.trim() || password.length < 6) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال كلمة مرور صحيحة (6 أحرف على الأقل)"));
      return;
    }
    if (isLogin) {
      handleLogin();
    } else {
      if (!name.trim()) {
        alertService.warning(tl("تنبيه"), tl("يرجى إدخال الاسم"));
        return;
      }
      handleOtpFlow();
    }
  };
  const handleLogin = async () => {
    setLoading(true);
    try {
      const fullPhone = getFullPhone();
      const result = await authApiService.login({
        phone: fullPhone,
        password: password.trim()
      });
      if (result.success) {
        alertService.toastSuccess(tl("تم تسجيل الدخول بنجاح"));
        // Use InteractionManager to ensure modal closing and transitions are smooth
        InteractionManager.runAfterInteractions(() => {
          onSuccess?.(result.user);
          onClose();
        });
      } else {
        showError(result.error, tl("فشل تسجيل الدخول"));
      }
    } catch (error) {
      showError(undefined, tl("حدث خطأ أثناء تسجيل الدخول"));
    } finally {
      setLoading(false);
    }
  };
  const handleForgotSendOtp = async () => {
    setLoading(true);
    try {
      const fullPhone = getFullPhone();
      const result = await authApiService.sendOtp(fullPhone, country, 'reset_password');
      if (result.success) {
        setForgotStep('otp');
        setResendCountdown(60);
        alertService.toastSuccess(tl("تم إرسال رمز التحقق"));
      } else {
        showError(result.error, tl("فشل إرسال رمز التحقق"));
      }
    } catch {
      showError(undefined, tl("حدث خطأ أثناء إرسال رمز التحقق"));
    } finally {
      setLoading(false);
    }
  };
  const handleForgotVerifyOtp = () => {
    if (forgotOtp.length !== 6) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال رمز التحقق المكون من 6 أرقام"));
      return;
    }
    setForgotStep('reset');
  };
  const handleForgotReset = async () => {
    if (!password.trim() || password.length < 6) {
      alertService.warning(tl("تنبيه"), tl("كلمة المرور يجب أن تكون 6 أحرف على الأقل"));
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      alertService.warning(tl("تنبيه"), tl("كلمتا المرور غير متطابقتين"));
      return;
    }
    setLoading(true);
    try {
      const fullPhone = getFullPhone();
      // Re-use the verified OTP code — server validates it again (not expired)
      const result = await authApiService.resetPassword(fullPhone, forgotOtp, password.trim());
      if (result.success) {
        alertService.toastSuccess(tl("تم تغيير كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول"));
        setIsForgotMode(false);
        setForgotStep('phone');
        setForgotOtp('');
        setPassword('');
        setConfirmPassword('');
        setIsLogin(true);
      } else {
        showError(result.error, tl("فشل إعادة تعيين كلمة المرور"));
      }
    } catch {
      showError(undefined, tl("حدث خطأ أثناء إعادة التعيين"));
    } finally {
      setLoading(false);
    }
  };
  const getFullPhone = () => {
    const selectedCountry = countries.find(c => c.code === country);
    const dial = selectedCountry?.dial || '+964';
    const dialNoPlus = dial.replace('+', '');

    // Clean: remove whitespace, dashes, parentheses
    let p = phone.trim().replace(/[\s\-\(\)]/g, '');

    // Handle international prefix "00XXX..."  (e.g. 009647701234567)
    if (p.startsWith('00' + dialNoPlus)) {
      p = p.substring(2 + dialNoPlus.length);
    }
    // Handle "+XXX..." already typed (e.g. +9647701234567)
    else if (p.startsWith('+' + dialNoPlus)) {
      p = p.substring(1 + dialNoPlus.length);
    }
    // Handle dial without + (e.g. 9647701234567)
    else if (p.startsWith(dialNoPlus) && p.length > dialNoPlus.length + 6) {
      p = p.substring(dialNoPlus.length);
    }
    // Handle leading + only
    else if (p.startsWith('+')) {
      p = p.substring(1);
    }

    // Remove leading zero (e.g. 07701234567 → 7701234567)
    if (p.startsWith('0')) p = p.substring(1);
    return dial + p;
  };
  const handleResendOtp = useCallback(async () => {
    if (resendCountdown > 0 || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const fullPhone = getFullPhone();
      const purpose = isForgotMode ? 'reset_password' : 'register';
      const result = await authApiService.sendOtp(fullPhone, country, purpose);
      if (result.success) {
        setResendCountdown(60);
        if (isForgotMode) setForgotOtp('');else setOtpCode('');
        alertService.toastSuccess(tl("تم إعادة إرسال رمز التحقق"));
      } else {
        showError(result.error, tl("فشل إعادة إرسال رمز التحقق"));
      }
    } catch (error) {
      showError(undefined, tl("حدث خطأ أثناء إعادة إرسال رمز التحقق"));
    } finally {
      setLoading(false);
    }
  }, [resendCountdown, loading, country, isForgotMode]);
  const handleOtpFlow = async () => {
    Keyboard.dismiss();
    const fullPhone = getFullPhone();
    const purpose = isForgotMode ? 'reset_password' : 'register';
    setLoading(true);
    try {
      const result = await authApiService.sendOtp(fullPhone, country, purpose);
      if (result.success) {
        setOtpVisible(true);
        if (result.devMode) {
          alertService.info(tl("تنبيه"), tl("تم إرسال رمز تجريبي في وضع التطوير"));
        }
      } else {
        showError(result.error, tl("فشل إرسال رمز التحقق"));
      }
    } catch (error) {
      showError(undefined, tl("حدث خطأ أثناء إرسال رمز التحقق"));
    } finally {
      setLoading(false);
    }
  };
  const handleVerifyAndAction = async () => {
    if (otpCode.length !== 6) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال رمز التحقق المكون من 6 أرقام"));
      return;
    }
    setVerifyingOtp(true);
    const fullPhone = getFullPhone();
    try {
      if (isForgotMode) {
        // Reset password flow
        const result = await authApiService.resetPassword(fullPhone, otpCode, password.trim());
        if (result.success) {
          setOtpVisible(false);
          alertService.toastSuccess(tl("تم تغيير كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول"));
          setIsForgotMode(false);
          setIsLogin(true);
          setOtpCode('');
        } else {
          showError(result.error, tl("فشل إعادة تعيين كلمة المرور"));
        }
      } else {
        // Registration flow
        const verifyResult = await authApiService.verifyOtp(fullPhone, otpCode);
        if (verifyResult.success) {
          const registerResult = await authApiService.register({
            phone: fullPhone,
            password: password.trim(),
            name: name.trim(),
            country,
            referralCode: referralCode.trim() || undefined
          });
          if (registerResult.success) {
            setOtpVisible(false);
            alertService.toastSuccess(tl("تم إنشاء الحساب بنجاح"));
            InteractionManager.runAfterInteractions(() => {
              onSuccess?.(registerResult.user);
              onClose();
            });
          } else {
            showError(registerResult.error, tl("فشل إنشاء الحساب"));
          }
        } else {
          showError(undefined, tl("رمز التحقق غير صحيح"));
        }
      }
    } catch (error) {
      showError(undefined, tl("حدث خطأ أثناء العملية"));
    } finally {
      setVerifyingOtp(false);
    }
  };
  return <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose} statusBarTranslucent>
        <View style={styles.container}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => onClose()} style={styles.backButton} activeOpacity={0.7}>
                            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                        <View style={styles.logoContainer}>
                            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
                        </View>

                        <View style={styles.titleBlock}>
                            <Text style={styles.screenTitle}>
                                {isForgotMode ? forgotStep === 'phone' ? tl("نسيت كلمة المرور") : forgotStep === 'otp' ? tl("رمز التحقق") : tl("كلمة مرور جديدة") : isLogin ? tl("تسجيل الدخول") : tl("إنشاء حساب")}
                            </Text>
                            {isForgotMode && <Text style={styles.screenSubtitle}>
                                    {forgotStep === 'phone' ? tl("أدخل رقم هاتفك لاستعادة حسابك") : forgotStep === 'otp' ? tl("أدخل الرمز المرسل إلى {{}}", [phone]) : tl("أنشئ كلمة مرور قوية جديدة")}
                                </Text>}
                        </View>

                        <View style={styles.formContainer}>
                            {localError && <View style={styles.errorBanner}>
                                    <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
                                    <Text style={styles.errorBannerText}>{localError}</Text>
                                </View>}

                            {/* ── Forgot: Step 1 — Phone ── */}
                            {isForgotMode && forgotStep === 'phone' && <View style={styles.phoneContainer}>
                                    <View style={styles.phoneInputWrapper}>
                                        <TouchableOpacity activeOpacity={0.7} onPress={() => setCountryPickerVisible(true)} style={[styles.dialCodeBox, {
                    borderRightWidth: 1
                  }]}>
                                            <Text style={styles.dialCodeText}>
                                                {countries.find(c => c.code === country)?.dial}
                                            </Text>
                                            <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} style={{
                      marginLeft: 4
                    }} />
                                        </TouchableOpacity>
                                        <TextInput value={phone} onChangeText={v => setPhone(convertArabicToEnglish(v))} placeholder={tl("رقم الهاتف")} placeholderTextColor={theme.colors.textMuted} style={styles.flexInput} keyboardType="phone-pad" textAlign="left" autoFocus />
                                    </View>
                                </View>}

                            {/* ── Forgot: Step 2 — OTP ── */}
                            {isForgotMode && forgotStep === 'otp' && <View>
                                    <View style={styles.singleOtpInputContainer}>
                                        <TextInput value={forgotOtp} onChangeText={v => setForgotOtp(convertArabicToEnglish(v))} placeholder="000000" placeholderTextColor={theme.colors.textMuted + '50'} style={styles.singleOtpInput} keyboardType="number-pad" maxLength={6} autoFocus selectionColor={theme.colors.primary} />
                                    </View>
                                    <TouchableOpacity onPress={handleResendOtp} disabled={resendCountdown > 0 || loading} style={styles.resendOtpButton}>
                                        <Text style={[styles.resendOtpText, resendCountdown > 0 && {
                    color: theme.colors.textMuted
                  }]}>
                                            {resendCountdown > 0 ? tl("إعادة الإرسال بعد {{}} ثانية", [resendCountdown]) : tl("إعادة إرسال الرمز")}
                                        </Text>
                                    </TouchableOpacity>
                                </View>}

                            {/* ── Forgot: Step 3 — New Password ── */}
                            {isForgotMode && forgotStep === 'reset' && <View>
                                    <View style={styles.passwordWrapper}>
                                        <TextInput value={password} onChangeText={v => setPassword(convertArabicToEnglishSimple(v))} placeholder={tl("كلمة المرور الجديدة")} placeholderTextColor={theme.colors.textMuted} style={styles.passwordInput} secureTextEntry={!showPassword} textAlign={isRTL ? 'right' : 'left'} autoFocus />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.passwordWrapper}>
                                        <TextInput value={confirmPassword} onChangeText={v => setConfirmPassword(convertArabicToEnglishSimple(v))} placeholder={tl("تأكيد كلمة المرور")} placeholderTextColor={theme.colors.textMuted} style={styles.passwordInput} secureTextEntry={!showConfirmPassword} textAlign={isRTL ? 'right' : 'left'} />
                                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                                            <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>}

                            {/* ── Login / Register fields ── */}
                            {!isForgotMode && <>
                                    {!isLogin && <TextInput value={name} onChangeText={v => setName(convertArabicToEnglishSimple(v))} placeholder={tl("الاسم الكامل")} placeholderTextColor={theme.colors.textMuted} style={styles.input} autoCapitalize="words" textAlign={isRTL ? 'right' : 'left'} />}

                                    <View style={styles.phoneContainer}>
                                        <View style={styles.phoneInputWrapper}>
                                            <TouchableOpacity activeOpacity={0.7} onPress={() => setCountryPickerVisible(true)} style={[styles.dialCodeBox, {
                      borderRightWidth: 1
                    }]}>
                                                <Text style={styles.dialCodeText}>
                                                    {countries.find(c => c.code === country)?.dial}
                                                </Text>
                                                <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} style={{
                        marginLeft: 4
                      }} />
                                            </TouchableOpacity>
                                            <TextInput value={phone} onChangeText={v => setPhone(convertArabicToEnglish(v))} placeholder={tl("رقم الهاتف")} placeholderTextColor={theme.colors.textMuted} style={styles.flexInput} keyboardType="phone-pad" textAlign="left" />
                                        </View>
                                    </View>

                                    {!isLogin && <TextInput value={referralCode} onChangeText={v => setReferralCode(convertArabicToEnglishSimple(v))} placeholder={tl("كود الإحالة (اختياري)")} placeholderTextColor={theme.colors.textMuted} style={[styles.input, {
                  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                  letterSpacing: 2
                }]} autoCapitalize="characters" autoCorrect={false} textAlign={isRTL ? 'right' : 'left'} />}

                                    <View style={styles.passwordWrapper}>
                                        <TextInput value={password} onChangeText={v => setPassword(convertArabicToEnglishSimple(v))} placeholder={tl("كلمة المرور")} placeholderTextColor={theme.colors.textMuted} style={styles.passwordInput} secureTextEntry={!showPassword} textAlign={isRTL ? 'right' : 'left'} />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>

                                    {isLogin && <TouchableOpacity onPress={() => setIsForgotMode(true)} style={styles.forgotButton}>
                                            <Text style={styles.forgotText}>{tl("نسيت كلمة المرور؟")}</Text>
                                        </TouchableOpacity>}
                                </>}

                            <TouchableOpacity onPress={handleSubmit} disabled={loading} style={styles.submitButton} activeOpacity={0.8}>
                                {loading ? <ActivityIndicator color={theme.colors.textInverse} /> : <Text style={styles.submitButtonText}>
                                        {isForgotMode ? forgotStep === 'phone' ? tl("إرسال رمز التحقق") : forgotStep === 'otp' ? tl("تحقق من الرمز") : tl("تغيير كلمة المرور") : isLogin ? tl("تسجيل الدخول") : tl("إنشاء الحساب")}
                                    </Text>}
                            </TouchableOpacity>

                            <View style={styles.switchContainer}>
                                <Text style={styles.switchText}>
                                    {isForgotMode ? tl("تذكرت كلمة المرور؟") : isLogin ? tl("ليس لديك حساب؟") : tl("لديك حساب بالفعل؟")}
                                </Text>
                                <TouchableOpacity onPress={() => {
                  if (isForgotMode) {
                    setIsForgotMode(false);
                    setForgotStep('phone');
                    setForgotOtp('');
                    setPassword('');
                    setConfirmPassword('');
                    setIsLogin(true);
                  } else {
                    setIsLogin(!isLogin);
                  }
                }} activeOpacity={0.7}>
                                    <Text style={styles.switchLink}>
                                        {isForgotMode ? tl("تسجيل الدخول") : isLogin ? tl("إنشاء حساب جديد") : tl("تسجيل الدخول")}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                {/* OTP Overlay (Replacement for Modal to avoid nesting which causes freezes) */}
                {otpVisible && <View style={StyleSheet.absoluteFill}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.otpModalOverlay}>
                            <View style={styles.otpModalContainer}>
                                <Text style={styles.otpTitle}>{tl("رمز التحقق")}</Text>
                                <Text style={styles.otpSubtitle}>{tl("أدخل الرمز المكون من 6 أرقام المرسل إلى")}{phone}</Text>

                                <View style={styles.singleOtpInputContainer}>
                                    <TextInput ref={otpInputRef} value={otpCode} onChangeText={v => setOtpCode(convertArabicToEnglish(v))} placeholder="000000" placeholderTextColor={theme.colors.textMuted + '50'} style={styles.singleOtpInput} keyboardType="number-pad" maxLength={6} autoFocus={true} selectionColor={theme.colors.primary} />
                                </View>

                                <TouchableOpacity onPress={handleVerifyAndAction} disabled={verifyingOtp} style={styles.verifyButton}>
                                    {verifyingOtp ? <ActivityIndicator color={theme.colors.textInverse} /> : <Text style={styles.verifyButtonText}>
                                            {isForgotMode ? tl("تغيير كلمة المرور") : tl("تحقق وتسجيل")}
                                        </Text>}
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleResendOtp} disabled={resendCountdown > 0 || loading} style={styles.resendOtpButton}>
                                    <Text style={[styles.resendOtpText, resendCountdown > 0 && {
                  color: theme.colors.textMuted
                }]}>
                                        {resendCountdown > 0 ? tl("إعادة الإرسال بعد {{}} ثانية", [resendCountdown]) : tl("إعادة إرسال الرمز")}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => setOtpVisible(false)} style={styles.cancelOtpButton}>
                                    <Text style={styles.cancelOtpText}>{tl("إلغاء")}</Text>
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>}

                {/* Country Picker Overlay (Replacement for Modal to avoid nesting) */}
                {countryPickerVisible && <View style={StyleSheet.absoluteFill}>
                        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCountryPickerVisible(false)}>
                            <View style={styles.pickerContainer}>
                                <View style={styles.pickerHeader}>
                                    <Text style={styles.pickerTitle}>{tl("اختر الدولة")}</Text>
                                    <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                                        <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.searchContainer}>
                                    <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
                                    <TextInput style={styles.searchInput} placeholder={tl("بحث عن دولة أو رمز...")} placeholderTextColor={theme.colors.textMuted} value={searchQuery} onChangeText={setSearchQuery} autoFocus={false} />
                                </View>
                                <ScrollView style={styles.pickerScroll}>
                                    {filteredCountries.map(c => <TouchableOpacity key={c.code} style={[styles.countryItem, country === c.code && {
                  backgroundColor: theme.colors.primary + '10'
                }]} onPress={() => {
                  setCountry(c.code);
                  setCountryPickerVisible(false);
                }}>
                                            <View style={styles.countryInfo}>
                                                <Text style={styles.countryNameText}>{c.name}</Text>
                                                <Text style={styles.countryCodeText}>{c.dial}</Text>
                                            </View>
                                            {country === c.code && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                                        </TouchableOpacity>)}
                                </ScrollView>
                            </View>
                        </TouchableOpacity>
                    </View>}
            </SafeAreaView>
        </View>
        </Modal>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  keyboardView: {
    flex: 1
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 30,
    height: 80,
    justifyContent: 'center',
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 48,
    paddingTop: 8,
    alignItems: 'stretch'
  },
  logoContainer: {
    marginBottom: 10,
    alignItems: 'center'
  },
  logo: {
    width: 128,
    height: 52
  },
  titleBlock: {
    marginBottom: 16,
    // alignSelf: isRTL ? 'flex-end' : 'flex-start',
    alignItems: 'center'
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  screenSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 6
  },
  formContainer: {
    width: '100%'
  },
  input: {
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 54,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 14,
    letterSpacing: 0,
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  phoneContainer: {
    marginBottom: 14
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden'
  },
  dialCodeText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary
  },
  passwordWrapper: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: 18,
    marginBottom: 14
  },
  passwordInput: {
    flex: 1,
    height: 54,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    paddingVertical: 0,
    letterSpacing: 0,
    writingDirection: isRTL ? 'rtl' : 'ltr'
  },
  eyeButton: {
    padding: 10
  },
  submitButton: {
    marginTop: 6,
    borderRadius: theme.borderRadius.xl,
    height: 52,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  submitButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily
  },
  switchContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    marginTop: 28,
    gap: 6,
    flexWrap: 'wrap'
  },
  switchText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily
  },
  switchLink: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily
  },
  forgotButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    marginTop: -4
  },
  forgotText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily
  },
  otpModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center'
  },
  otpModalContainer: {
    width: width * 0.85,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...getPlatformShadow('lg')
  },
  otpTitle: {
    fontSize: 22,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8
  },
  otpSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 24
  },
  singleOtpInputContainer: {
    width: '100%',
    marginBottom: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  singleOtpInput: {
    width: '80%',
    height: 60,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    fontSize: 28,
    fontWeight: getPlatformFontWeight('700'),
    letterSpacing: 10,
    textAlign: 'center',
    padding: 0,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    ...getPlatformShadow('sm')
  },
  verifyButton: {
    width: '100%',
    height: 52,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  verifyButtonText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  },
  resendOtpButton: {
    padding: 10,
    marginBottom: 4
  },
  resendOtpText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  cancelOtpButton: {
    padding: 12
  },
  cancelOtpText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end'
  },
  pickerContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    maxHeight: '70%',
    paddingBottom: 40
  },
  pickerHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight
  },
  pickerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  searchContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48
  },
  searchIcon: {
    marginHorizontal: 4
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  pickerScroll: {
    padding: 10
  },
  countryItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 4
  },
  countryInfo: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12
  },
  countryNameText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  countryCodeText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  dialCodeBox: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderColor: theme.colors.border
  },
  flexInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 18,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    letterSpacing: 0,
    writingDirection: 'ltr'
  },
  errorBanner: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.error + '30'
  },
  errorBannerText: {
    flex: 1,
    color: theme.colors.error,
    fontSize: 14,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  }
});
