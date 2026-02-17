import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { authApiService } from '../services/authApiService';
import { alertService } from '../services/alertService';

const { width } = Dimensions.get('window');

export const AuthScreen = ({ navigation, route }: any) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const [isLogin, setIsLogin] = useState(true);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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

        if (!isLogin && !name.trim()) {
            alertService.warning('تنبيه', 'يرجى إدخال الاسم');
            return;
        }

        setLoading(true);

        try {
            if (isLogin) {
                const result = await authApiService.login({
                    phone: phone.trim(),
                    password: password.trim(),
                });

                if (result.success) {
                    alertService.success('نجح', 'تم تسجيل الدخول بنجاح');
                    onSuccess?.(result.user);
                    navigation.goBack();
                } else {
                    alertService.error('خطأ', result.error || 'فشل تسجيل الدخول');
                }
            } else {
                const result = await authApiService.register({
                    phone: phone.trim(),
                    password: password.trim(),
                    name: name.trim(),
                });

                if (result.success) {
                    alertService.success('نجح', 'تم إنشاء الحساب بنجاح');
                    if (result.user) {
                        onSuccess?.(result.user);
                        navigation.goBack();
                    } else {
                        setIsLogin(true);
                    }
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
                                {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
                            </Text>
                          
                        </View>

                        <View style={styles.formContainer}>
                            {!isLogin && (
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="الاسم الكامل"
                                    placeholderTextColor={theme.colors.textMuted}
                                    style={styles.input}
                                    autoCapitalize="words"
                                    textAlign={isRTL ? 'right' : 'left'}
                                />
                            )}

                            <TextInput
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="رقم الهاتف"
                                placeholderTextColor={theme.colors.textMuted}
                                style={styles.input}
                                keyboardType="phone-pad"
                                textAlign={isRTL ? 'right' : 'left'}
                            />

                            <View style={styles.passwordWrapper}>
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="كلمة المرور"
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
                                        {isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب'}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.switchContainer}>
                                <Text style={styles.switchText}>
                                    {isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
                                </Text>
                                <TouchableOpacity onPress={() => setIsLogin(!isLogin)} activeOpacity={0.7}>
                                    <Text style={styles.switchLink}>
                                        {isLogin ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
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
        letterSpacing: -0.5,
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
});
