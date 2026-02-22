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


    const countries = [
        { name: 'العراق', code: 'IQ', dial: '+964' },
        { name: 'السعودية', code: 'SA', dial: '+966' },
        { name: 'الإمارات', code: 'AE', dial: '+971' },
        { name: 'مصر', code: 'EG', dial: '+20' },
        { name: 'الأردن', code: 'JO', dial: '+962' },
        { name: 'الكويت', code: 'KW', dial: '+965' },
        { name: 'قطر', code: 'QA', dial: '+974' },
        { name: 'عمان', code: 'OM', dial: '+968' },
        { name: 'البحرين', code: 'BH', dial: '+973' },
        { name: 'لبنان', code: 'LB', dial: '+961' },
        { name: 'سوريا', code: 'SY', dial: '+963' },
        { name: 'فلسطين', code: 'PS', dial: '+970' },
        { name: 'تونس', code: 'TN', dial: '+216' },
        { name: 'المغرب', code: 'MA', dial: '+212' },
        { name: 'الجزائر', code: 'DZ', dial: '+213' },
        { name: 'ليبيا', code: 'LY', dial: '+218' },
        { name: 'السودان', code: 'SD', dial: '+249' },
        { name: 'اليمن', code: 'YE', dial: '+967' },
        { name: 'موريتانيا', code: 'MR', dial: '+222' },
        { name: 'جيبوتي', code: 'DJ', dial: '+253' },
        { name: 'الصومال', code: 'SO', dial: '+252' },
        { name: 'جزر القمر', code: 'KM', dial: '+269' },
    ];

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
    }, [resendCountdown, loading, country]);

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
            <StatusBar barStyle="dark-content" />
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
                                color="#1F2937"
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
                                            style={[styles.dialCodeBox, isRTL ? { borderLeftWidth: 1 } : { borderRightWidth: 1 }]}
                                        >
                                            <Text style={styles.dialCodeText}>
                                                {countries.find(c => c.code === country)?.dial}
                                            </Text>
                                            <Ionicons name="chevron-down" size={12} color="#64748B" style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    )}
                                    <TextInput
                                        value={phone}
                                        onChangeText={(v) => setPhone(convertArabicToEnglish(v))}
                                        placeholder="رقم الهاتف"
                                        placeholderTextColor={theme.colors.textMuted}
                                        style={styles.flexInput}
                                        keyboardType="phone-pad"
                                        textAlign={isRTL ? 'right' : 'left'}
                                    />
                                </View>
                            </View>

                            {!isLogin && !isForgotMode && (
                                <TextInput
                                    value={referralCode}
                                    onChangeText={(v) => setReferralCode(convertArabicToEnglishSimple(v))}
                                    placeholder="كود الإحالة (اختياري)"
                                    placeholderTextColor={theme.colors.textMuted}
                                    style={styles.input}
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
                                    <ActivityIndicator color="#FFFFFF" />
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
                    >
                        <View style={styles.otpModalOverlay}>
                            <View style={styles.otpModalContainer}>
                                <Text style={styles.otpTitle}>رمز التحقق</Text>
                                <Text style={styles.otpSubtitle}>أدخل الرمز المكون من 6 أرقام المرسل إلى {phone}</Text>

                                <TouchableOpacity
                                    activeOpacity={1}
                                    onPress={() => otpInputRef.current?.focus()}
                                    style={[styles.otpInputRow, { flexDirection: 'row' }]}
                                >
                                    {[0, 1, 2, 3, 4, 5].map((index) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.otpBox,
                                                otpCode.length === index && styles.otpBoxActive,
                                                otpCode.length > index && styles.otpBoxFilled,
                                            ]}
                                        >
                                            <Text style={styles.otpBoxText}>
                                                {otpCode[index] || ''}
                                            </Text>
                                            {otpCode.length === index && (
                                                <View style={styles.otpCursor} />
                                            )}
                                        </View>
                                    ))}
                                    <TextInput
                                        ref={otpInputRef}
                                        value={otpCode}
                                        onChangeText={(v) => setOtpCode(convertArabicToEnglish(v))}
                                        style={styles.hiddenInput}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        autoFocus={true}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleVerifyAndAction}
                                    disabled={verifyingOtp}
                                    style={styles.verifyButton}
                                >
                                    {verifyingOtp ? (
                                        <ActivityIndicator color="#FFFFFF" />
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
                                        resendCountdown > 0 && { color: '#94A3B8' }
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
                                <ScrollView style={styles.pickerScroll}>
                                    {countries.map((c) => (
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
        backgroundColor: '#F8FAFC',
    },
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC',
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
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
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
        color: '#0F172A',
        fontFamily: theme.typography.fontFamily,
        textAlign: 'center',
    },
    screenSubtitle: {
        fontSize: 15,
        color: '#64748B',
        fontFamily: theme.typography.fontFamily,
        marginTop: 6,
    },
    formContainer: {
        width: '100%',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
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
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderRadius: 14,
        overflow: 'hidden',
    },
    dialCodeText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#475569',
    },
    passwordWrapper: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
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
        color: '#FFFFFF',
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
        color: '#64748B',
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
        color: '#64748B',
        fontSize: 14,
        fontFamily: theme.typography.fontFamily,
    },
    otpModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    otpModalContainer: {
        width: width * 0.85,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        ...getPlatformShadow('lg'),
    },
    otpTitle: {
        fontSize: 22,
        fontWeight: getPlatformFontWeight('700'),
        color: '#0F172A',
        fontFamily: theme.typography.fontFamily,
        marginBottom: 8,
    },
    otpSubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily,
        marginBottom: 24,
    },
    otpInputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 30,
        position: 'relative',
    },
    otpBox: {
        width: 44,
        height: 56,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    otpBoxActive: {
        borderColor: theme.colors.primary,
        backgroundColor: '#FFFFFF',
        ...getPlatformShadow('sm'),
    },
    otpBoxFilled: {
        borderColor: theme.colors.primary + '40',
        backgroundColor: '#FFFFFF',
    },
    otpBoxText: {
        fontSize: 22,
        fontWeight: '700',
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
    },
    otpCursor: {
        position: 'absolute',
        bottom: 12,
        width: 14,
        height: 2,
        backgroundColor: theme.colors.primary,
    },
    hiddenInput: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0,
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
        color: '#FFFFFF',
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
        color: '#64748B',
        fontSize: 15,
        fontFamily: theme.typography.fontFamily,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerContainer: {
        backgroundColor: '#FFFFFF',
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
        borderBottomColor: '#F1F5F9',
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        fontFamily: theme.typography.fontFamily,
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
        color: '#1E293B',
        fontFamily: theme.typography.fontFamily,
    },
    countryCodeText: {
        fontSize: 14,
        color: '#64748B',
        fontFamily: theme.typography.fontFamily,
    },
    dialCodeBox: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        height: 54,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    flexInput: {
        flex: 1,
        height: 54,
        paddingHorizontal: 18,
        fontSize: 16,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        letterSpacing: 0,
        writingDirection: isRTL ? 'rtl' : 'ltr',
    },
});
