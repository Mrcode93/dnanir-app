import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { type AppTheme, getPlatformFontWeight, getPlatformShadow } from '../utils/theme-constants';
import { isRTL } from '../utils/rtl';
import { promoService } from '../services/promoService';
import { alertService } from '../services/alertService';

interface PromoCodeModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const PromoCodeModal: React.FC<PromoCodeModalProps> = ({ visible, onClose, onSuccess }) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleApply = async () => {
        setError(null);
        if (!code.trim()) {
            setError('يرجى إدخال كود البرومو');
            return;
        }

        setLoading(true);
        try {
            const result = await promoService.applyCode(code);
            if (result.success) {
                alertService.toastSuccess(result.message || 'تم تفعيل كود البرومو بنجاح!');
                setCode('');
                setError(null);
                onClose();
                if (onSuccess) onSuccess();
            } else {
                const errorMessage = typeof result.error === 'string' ? result.error : 'كود البرومو غير صالح أو منتهي الصلاحية';
                setError(errorMessage);
            }
        } catch (error) {
            setError('حدث خطأ أثناء تفعيل الكود، يرجى المحاولة لاحقاً');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.overlay}>
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View style={styles.container}>
                                <View style={styles.content}>
                                    <LinearGradient
                                        colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                                        style={styles.gradient}
                                    >
                                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                                        </TouchableOpacity>

                                        <View style={styles.header}>
                                            <LinearGradient
                                                colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']}
                                                style={styles.iconWrapper}
                                            >
                                                <Ionicons name="gift" size={36} color="#D4AF37" />
                                            </LinearGradient>
                                            <Text style={styles.title}>كود البرومو</Text>
                                            <Text style={styles.subtitle}>أدخل الكود للحصول على مميزات اشتراك "برو" مجانية</Text>
                                        </View>

                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="ticket-outline" size={22} color={theme.colors.primary} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="أدخل الكود هنا (مثال: FREE30)"
                                                placeholderTextColor={theme.colors.textMuted}
                                                value={code}
                                                onChangeText={(text) => {
                                                    setCode(text.toUpperCase());
                                                    if (error) setError(null);
                                                }}
                                                autoCapitalize="characters"
                                                autoCorrect={false}
                                                returnKeyType="done"
                                                onSubmitEditing={handleApply}
                                            />
                                        </View>

                                        {error && (
                                            <View style={styles.errorContainer}>
                                                <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
                                                <Text style={styles.errorText}>{error}</Text>
                                            </View>
                                        )}

                                        <View style={styles.actions}>
                                            <TouchableOpacity
                                                style={styles.applyButton}
                                                onPress={handleApply}
                                                disabled={loading}
                                            >
                                                <LinearGradient
                                                    colors={['#D4AF37', '#B8860B']}
                                                    style={styles.applyButtonGradient}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                >
                                                    {loading ? (
                                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                                    ) : (
                                                        <View style={styles.buttonContent}>
                                                            <Text style={styles.applyButtonText}>تفعيل الآن</Text>
                                                            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                                                        </View>
                                                    )}
                                                </LinearGradient>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.cancelButton}
                                                onPress={onClose}
                                                disabled={loading}
                                            >
                                                <Text style={styles.cancelButtonText}>إلغاء</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </LinearGradient>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Platform.OS === 'android' ? 12 : 24,
        backgroundColor: theme.colors.overlay,
    },
    container: {
        width: '100%',
        maxWidth: 400,
    },
    content: {
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        ...getPlatformShadow('xl'),
    },
    gradient: {
        padding: Platform.OS === 'android' ? 20 : 28,
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        padding: 8,
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: Platform.OS === 'android' ? 16 : 24,
        marginTop: Platform.OS === 'android' ? 0 : 10,
    },
    iconWrapper: {
        width: Platform.OS === 'android' ? 64 : 80,
        height: Platform.OS === 'android' ? 64 : 80,
        borderRadius: Platform.OS === 'android' ? 20 : 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Platform.OS === 'android' ? 12 : 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    title: {
        fontSize: Platform.OS === 'android' ? 20 : 24,
        fontWeight: getPlatformFontWeight('900'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: Platform.OS === 'android' ? 8 : 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    inputWrapper: {
        width: '100%',
        height: Platform.OS === 'android' ? 54 : 64,
        backgroundColor: theme.colors.background,
        borderRadius: Platform.OS === 'android' ? 16 : 20,
        flexDirection: isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: Platform.OS === 'android' ? 20 : 28,
        borderWidth: 2,
        borderColor: theme.colors.border,
    },
    inputIcon: {
        marginLeft: isRTL ? 0 : 12,
        marginRight: isRTL ? 12 : 0,
    },
    input: {
        flex: 1,
        height: '100%',
        color: theme.colors.textPrimary,
        fontSize: 18,
        fontWeight: getPlatformFontWeight('800'),
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    actions: {
        width: '100%',
        gap: 16,
    },
    applyButton: {
        width: '100%',
        height: Platform.OS === 'android' ? 50 : 60,
        borderRadius: Platform.OS === 'android' ? 16 : 20,
        overflow: 'hidden',
        ...getPlatformShadow('md'),
    },
    applyButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: getPlatformFontWeight('900'),
        fontFamily: theme.typography.fontFamily,
    },
    cancelButton: {
        width: '100%',
        height: Platform.OS === 'android' ? 44 : 54,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: getPlatformFontWeight('700'),
        fontFamily: theme.typography.fontFamily,
    },
    errorContainer: {
        flexDirection: isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.error + '15',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginBottom: 20,
        gap: 6,
    },
    errorText: {
        color: theme.colors.error,
        fontSize: 14,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
        textAlign: 'center',
    },
});
