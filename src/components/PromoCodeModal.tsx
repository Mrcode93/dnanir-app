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

    const handleApply = async () => {
        if (!code.trim()) {
            alertService.warning('تنبيه', 'يرجى إدخال كود البرومو');
            return;
        }

        setLoading(true);
        try {
            const result = await promoService.applyCode(code);
            if (result.success) {
                alertService.success('تم التفعيل', result.message || 'تم تفعيل كود البرومو بنجاح!');
                setCode('');
                onClose();
                if (onSuccess) onSuccess();
            } else {
                alertService.error('فشل التفعيل', result.error || 'كود البرومو غير صالح أو منتهي الصلاحية');
            }
        } catch (error) {
            alertService.error('خطأ', 'حدث خطأ أثناء تفعيل الكود');
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
                                                onChangeText={(text) => setCode(text.toUpperCase())}
                                                autoCapitalize="characters"
                                                autoCorrect={false}
                                                returnKeyType="done"
                                                onSubmitEditing={handleApply}
                                            />
                                        </View>

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
        padding: 24,
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
        padding: 28,
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
        marginBottom: 32,
        marginTop: 10,
    },
    iconWrapper: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    title: {
        fontSize: 24,
        fontWeight: getPlatformFontWeight('900'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 12,
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
        height: 64,
        backgroundColor: theme.colors.background,
        borderRadius: 20,
        flexDirection: isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 28,
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
        height: 60,
        borderRadius: 20,
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
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: getPlatformFontWeight('700'),
        fontFamily: theme.typography.fontFamily,
    },
});
