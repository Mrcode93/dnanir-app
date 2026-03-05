import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    ScrollView,
    Dimensions,
    StatusBar,
    Image,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { authApiService } from '../services/authApiService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, convertArabicToEnglishSimple } from '../utils/numbers';
import { COUNTRIES } from '../constants/countries';

const { width } = Dimensions.get('window');

export const AuthScreen = ({ navigation, route }: any) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const otpInputRef = React.useRef<TextInput>(null);
    const [isLogin, setIsLogin] = useState(route?.params?.isLogin !== false);
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
    const [resendCountdown, setResendCountdown] = useState(0);
    const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const filteredCountries = countries.filter(c =>
        c.name.includes(searchQuery) ||
        c.dial.includes(searchQuery) ||
        c.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const onSuccess = route?.params?.onSuccess;

    const handleSubmit = async () => {
        if (!phone.trim()) {
            alertService.warning('تنبيه', 'يرجى إدخال رقم الهاتف');
            return;
        }

        if (!password.trim() || password.length < 6) {
            alertService.warning('تنبيه', 'يرجى إدخال كلمة مرور صحيحة (6 أحرف على الأقل)');
            return;
        }

        if (isLogin && !isForgotMode) {
            handleLogin();
        } else {
            if (!isForgotMode && !name.trim()) {
                alertService.warning('تنبيه', 'يرجى إدخال الاسم');
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
                password: password.trim(),
            });

            if (result.success) {
                alertService.success('نجح', 'تم تسجيل الدخول بنجاح');
                onSuccess?.(result.user);
                navigation.goBack();
            } else {
                alertService.error('خطأ', result.error || 'فشل تسجيل الدخول');
            }
        } catch (error) {
            console.error('Login error:', error);
            alertService.error('خطأ', 'حدث خطأ أثناء تسجيل الدخول');
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
        setLoading(true);
        try {
            const fullPhone = getFullPhone();
            const purpose = isForgotMode ? 'reset_password' : 'register';
            const result = await authApiService.sendOtp(fullPhone, country, purpose);
            if (result.success) {
                setResendCountdown(60);
                setOtpCode('');
                alertService.success('تم', 'تم إعادة إرسال رمز التحقق');
            } else {
                alertService.error('خطأ', result.error || 'فشل إعادة إرسال رمز التحقق');
            }
        } catch (error) {
            alertService.error('خطأ', 'حدث خطأ أثناء إعادة إرسال رمز التحقق');
        } finally {
            setLoading(false);
        }
    }, [resendCountdown, loading, country, isForgotMode]);

    const handleOtpFlow = async () => {
        const fullPhone = getFullPhone();
        const purpose = isForgotMode ? 'reset_password' : 'register';
        setLoading(true);
        try {
            const result = await authApiService.sendOtp(fullPhone, country, purpose);
            if (result.success) {
                setOtpVisible(true);
                if (result.devMode) {
                    alertService.info('تنبيه', 'تم إرسال رمز تجريبي في وضع التطوير');
                }
            } else {
                alertService.error('خطأ', result.error || 'فشل إرسال رمز التحقق');
            }
        } catch (error) {
            console.error('Send OTP error:', error);
            alertService.error('خطأ', 'حدث خطأ أثناء إرسال رمز التحقق');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndAction = async () => {
        if (otpCode.length !== 6) {
            alertService.warning('تنبيه', 'يرجى إدخال رمز التحقق المكون من 6 أرقام');
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
                    alertService.success('نجح', 'تم تغيير كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول');
                    setIsForgotMode(false);
                    setIsLogin(true);
                    setOtpCode('');
                } else {
                    alertService.error('خطأ', result.error || 'فشل إعادة تعيين كلمة المرور');
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
                        referralCode: referralCode.trim() || undefined,
                    });

                    if (registerResult.success) {
                        setOtpVisible(false);
                        alertService.success('نجح', 'تم إنشاء الحساب بنجاح');
                        onSuccess?.(registerResult.user);
                        navigation.goBack();
                    } else {
                        alertService.error('خطأ', registerResult.error || 'فشل إنشاء الحساب');
                    }
                } else {
                    alertService.error('خطأ', 'رمز التحقق غير صحيح');
                }
            }
        } catch (error) {
            console.error('Verify and action error:', error);
            alertService.error('خطأ', 'حدث خطأ أثناء العملية');
        } finally {
            setVerifyingOtp(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.colors.background === '#F8F9FA' ? 'dark-content' : 'light-content'} />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                                size={24}
                                color={theme.colors.text}
                            />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.logoContainer}>
                            <Image
                                source={require('../../assets/logo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>

                        <View style={styles.titleBlock}>
                            <Text style={styles.screenTitle}>
                                {isForgotMode ? 'نسيت كلمة المرور' : (isLogin ? 'تسجيل الدخول' : 'إنشاء حساب')}
                            </Text>
                            {isForgotMode && (
                                <Text style={styles.screenSubtitle}>
                                    أدخل رقم هاتفك وكلمة المرور الجديدة لإعادة التعيين
                                </Text>
                            )}
                        </View>

                        <View style={styles.formContainer}>
                            {!isLogin && !isForgotMode && (
                                <TextInput
                                    value={name}
                                    onChangeText={(v) => setName(convertArabicToEnglishSimple(v))}
                                    placeholder="الاسم الكامل"
                                    placeholderTextColor={theme.colors.textMuted}
                                    style={styles.input}
                                    autoCapitalize="words"
                                    textAlign={isRTL ? 'right' : 'left'}
                                />
                            )}

                            <View style={styles.phoneContainer}>

                                <View style={styles.phoneInputWrapper}>
                                    {true && (
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => setCountryPickerVisible(true)}
                                            style={[styles.dialCodeBox, { borderRightWidth: 1 }]}
                                        >
                                            <Text style={styles.dialCodeText}>
                                                {countries.find(c => c.code === country)?.dial}
                                            </Text>
                                            <Ionicons name="chevron-down" size={12} color={theme.colors.textSecondary} style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    )}
                                    <TextInput
                                        value={phone}
                                        onChangeText={(v) => setPhone(convertArabicToEnglish(v))}
                                        placeholder="رقم الهاتف"
                                        placeholderTextColor={theme.colors.textMuted}
                                        style={styles.flexInput}
                                        keyboardType="phone-pad"
                                        textAlign="left"
                                    />
                                </View>
                            </View>

                            {!isLogin && !isForgotMode && (
                                <TextInput
                                    value={referralCode}
                                    onChangeText={(v) => setReferralCode(convertArabicToEnglishSimple(v))}
                                    placeholder="كود الإحالة (اختياري)"
                                    placeholderTextColor={theme.colors.textMuted}
                                    style={[styles.input, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2 }]}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    textAlign={isRTL ? 'right' : 'left'}
                                />
                            )}

                            <View style={styles.passwordWrapper}>
                                <TextInput
                                    value={password}
                                    onChangeText={(v) => setPassword(convertArabicToEnglishSimple(v))}
                                    placeholder={isForgotMode ? "كلمة المرور الجديدة" : "كلمة المرور"}
                                    placeholderTextColor={theme.colors.textMuted}
                                    style={styles.passwordInput}
                                    secureTextEntry={!showPassword}
                                    textAlign={isRTL ? 'right' : 'left'}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeButton}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={theme.colors.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>

                            {isLogin && !isForgotMode && (
                                <TouchableOpacity
                                    onPress={() => setIsForgotMode(true)}
                                    style={styles.forgotButton}
                                >
                                    <Text style={styles.forgotText}>نسيت كلمة المرور؟</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={loading}
                                style={styles.submitButton}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color={theme.colors.textInverse} />
                                ) : (
                                    <Text style={styles.submitButtonText}>
                                        {isForgotMode ? 'تغيير كلمة المرور' : (isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب')}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.switchContainer}>
                                <Text style={styles.switchText}>
                                    {isForgotMode ? 'تذكرت كلمة المرور؟' : (isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟')}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (isForgotMode) {
                                            setIsForgotMode(false);
                                            setIsLogin(true);
                                        } else {
                                            setIsLogin(!isLogin);
                                        }
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.switchLink}>
                                        {isForgotMode ? 'تسجيل الدخول' : (isLogin ? 'إنشاء حساب جديد' : 'تسجيل الدخول')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                    {/* OTP Modal */}
                    <Modal
                        visible={otpVisible}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setOtpVisible(false)}
                        onShow={() => setTimeout(() => otpInputRef.current?.focus(), 150)}
                    >
                        <View style={styles.otpModalOverlay}>
                            <View style={styles.otpModalContainer}>
                                <Text style={styles.otpTitle}>رمز التحقق</Text>
                                <Text style={styles.otpSubtitle}>أدخل الرمز المكون من 6 أرقام المرسل إلى {phone}</Text>

                                <View style={styles.singleOtpInputContainer}>
                                    <TextInput
                                        ref={otpInputRef}
                                        value={otpCode}
                                        onChangeText={(v) => setOtpCode(convertArabicToEnglish(v))}
                                        placeholder="000000"
                                        placeholderTextColor={theme.colors.textMuted + '50'}
                                        style={styles.singleOtpInput}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        autoFocus={true}
                                        selectionColor={theme.colors.primary}
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleVerifyAndAction}
                                    disabled={verifyingOtp}
                                    style={styles.verifyButton}
                                >
                                    {verifyingOtp ? (
                                        <ActivityIndicator color={theme.colors.textInverse} />
                                    ) : (
                                        <Text style={styles.verifyButtonText}>
                                            {isForgotMode ? 'تغيير كلمة المرور' : 'تحقق وتسجيل'}
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleResendOtp}
                                    disabled={resendCountdown > 0 || loading}
                                    style={styles.resendOtpButton}
                                >
                                    <Text style={[
                                        styles.resendOtpText,
                                        resendCountdown > 0 && { color: theme.colors.textMuted }
                                    ]}>
                                        {resendCountdown > 0
                                            ? `إعادة الإرسال بعد ${resendCountdown} ثانية`
                                            : 'إعادة إرسال الرمز'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setOtpVisible(false)}
                                    style={styles.cancelOtpButton}
                                >
                                    <Text style={styles.cancelOtpText}>إلغاء</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {/* Country Picker Modal */}
                    <Modal
                        visible={countryPickerVisible}
                        transparent={true}
                        animationType="slide"
                        onRequestClose={() => setCountryPickerVisible(false)}
                    >
                        <TouchableOpacity
                            style={styles.modalOverlay}
                            activeOpacity={1}
                            onPress={() => setCountryPickerVisible(false)}
                        >
                            <View style={styles.pickerContainer}>
                                <View style={styles.pickerHeader}>
                                    <Text style={styles.pickerTitle}>اختر الدولة</Text>
                                    <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                                        <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.searchContainer}>
                                    <Ionicons name="search" size={20} color={theme.colors.textMuted} style={styles.searchIcon} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="بحث عن دولة أو رمز..."
                                        placeholderTextColor={theme.colors.textMuted}
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoFocus={false}
                                    />
                                </View>
                                <ScrollView style={styles.pickerScroll}>
                                    {filteredCountries.map((c) => (
                                        <TouchableOpacity
                                            key={c.code}
                                            style={[
                                                styles.countryItem,
                                                country === c.code && { backgroundColor: theme.colors.primary + '10' }
                                            ]}
                                            onPress={() => {
                                                setCountry(c.code);
                                                setCountryPickerVisible(false);
                                            }}
                                        >
                                            <View style={styles.countryInfo}>
                                                <Text style={styles.countryNameText}>{c.name}</Text>
                                                <Text style={styles.countryCodeText}>{c.dial}</Text>
                                            </View>
                                            {country === c.code && (
                                                <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 4,
        height: 52,
        justifyContent: 'center',
        alignItems: isRTL ? 'flex-end' : 'flex-start',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: theme.colors.surfaceCard,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    scrollContent: {
        paddingHorizontal: 28,
        paddingBottom: 48,
        paddingTop: 8,
        alignItems: 'stretch',
    },
    logoContainer: {
        marginBottom: 10,
        alignItems: 'center',
    },
    logo: {
        width: 128,
        height: 52,
    },
    titleBlock: {
        marginBottom: 16,
        // alignSelf: isRTL ? 'flex-end' : 'flex-start',
        alignItems: 'center',
    },
    screenTitle: {
        fontSize: 26,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'center',
    },
    screenSubtitle: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        marginTop: 6,
    },
    formContainer: {
        width: '100%',
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
        writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    phoneContainer: {
        marginBottom: 14,
    },
    phoneInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceCard,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 14,
        overflow: 'hidden',
    },
    dialCodeText: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.textSecondary,
    },
    passwordWrapper: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceCard,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 14,
        paddingHorizontal: 18,
        marginBottom: 14,
    },
    passwordInput: {
        flex: 1,
        height: 54,
        fontSize: 16,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        paddingVertical: 0,
        letterSpacing: 0,
        writingDirection: isRTL ? 'rtl' : 'ltr',
    },
    eyeButton: {
        padding: 10,
    },
    submitButton: {
        marginTop: 6,
        borderRadius: 14,
        height: 54,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 17,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textInverse,
        fontFamily: theme.typography.fontFamily,
    },
    switchContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'center',
        marginTop: 28,
        gap: 6,
        flexWrap: 'wrap',
    },
    switchText: {
        color: theme.colors.textSecondary,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily,
    },
    switchLink: {
        color: theme.colors.primary,
        fontSize: 15,
        fontWeight: getPlatformFontWeight('600'),
        fontFamily: theme.typography.fontFamily,
    },
    forgotButton: {
        alignSelf: 'flex-start',
        marginBottom: 20,
        marginTop: -4,
    },
    forgotText: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        fontFamily: theme.typography.fontFamily,
    },
    otpModalOverlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    otpModalContainer: {
        width: width * 0.85,
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        ...getPlatformShadow('lg'),
    },
    otpTitle: {
        fontSize: 22,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 8,
    },
    otpSubtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily,
        marginBottom: 24,
    },
    singleOtpInputContainer: {
        width: '100%',
        marginBottom: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    singleOtpInput: {
        width: '80%',
        height: 60,
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: theme.colors.primary,
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 10,
        textAlign: 'center',
        padding: 0,
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
        ...getPlatformShadow('sm'),
    },
    verifyButton: {
        width: '100%',
        height: 52,
        backgroundColor: theme.colors.primary,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    verifyButtonText: {
        color: theme.colors.textInverse,
        fontSize: 16,
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
    },
    resendOtpButton: {
        padding: 10,
        marginBottom: 4,
    },
    resendOtpText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
        textAlign: 'center',
    },
    cancelOtpButton: {
        padding: 12,
    },
    cancelOtpText: {
        color: theme.colors.textSecondary,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'flex-end',
    },
    pickerContainer: {
        backgroundColor: theme.colors.surfaceCard,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '70%',
        paddingBottom: 40,
    },
    pickerHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borderLight,
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
    },
    searchContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceLight,
        margin: 16,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    searchIcon: {
        marginHorizontal: 4,
    },
    searchInput: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    pickerScroll: {
        padding: 10,
    },
    countryItem: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 4,
    },
    countryInfo: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
    },
    countryNameText: {
        fontSize: 16,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
    },
    countryCodeText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
    },
    dialCodeBox: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceLight,
        borderColor: theme.colors.border,
    },
    flexInput: {
        flex: 1,
        height: 54,
        paddingHorizontal: 18,
        fontSize: 16,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        letterSpacing: 0,
        writingDirection: 'ltr',
    },
});
