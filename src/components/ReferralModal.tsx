import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { type AppTheme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme-constants';
import { referralService } from '../services/referralService';
import { alertService } from '../services/alertService';


interface ReferralModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (rewardDays: number) => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ visible, onClose, onSuccess }) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleApply = async () => {
        if (!code.trim()) {
            alertService.warning('تنبيه', 'يرجى إدخال كود الإحالة');
            return;
        }

        setLoading(true);
        try {
            const result = await referralService.applyCode(code.trim());
            if (result.success) {
                alertService.success('تم التفعيل', result.message || 'تم تفعيل الكود بنجاح');
                onSuccess(result.data?.rewardDays || 7);
                onClose();
            } else {
                alertService.error('خطأ', result.error || 'كود الإحالة غير صحيح');
            }
        } catch (error) {
            console.error('Apply referral error:', error);
            alertService.error('خطأ', 'حدث خطأ أثناء تفعيل الكود');
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async () => {
        await referralService.markDismissed();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.overlay}>
                    <View style={styles.modalContainer}>
                        <LinearGradient
                            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                            style={styles.gradient}
                        >
                            <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
                                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>

                            <View style={styles.content}>
                                <View
                                    style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}
                                >
                                    <Ionicons name="gift" size={50} color={theme.colors.primary} />
                                </View>

                                <Text style={styles.title}>لديك كود إحالة؟</Text>
                                <Text style={styles.subtitle}>
                                    أدخل كود الإحالة الذي حصلت عليه من صديقك لتحصل أنت وهو على 7 أيام اشتراك "برو" مجاناً!
                                </Text>

                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="مثال: DN-A7BC12"
                                        placeholderTextColor={theme.colors.textMuted}
                                        value={code}
                                        onChangeText={setCode}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        textAlign="center"
                                    />
                                </View>

                                <TouchableOpacity
                                    style={styles.applyButton}
                                    onPress={handleApply}
                                    disabled={loading}
                                    activeOpacity={0.8}
                                >
                                    <View
                                        style={[styles.applyButtonGradient, { backgroundColor: theme.colors.primary }]}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color={theme.colors.textInverse} />
                                        ) : (
                                            <View style={styles.buttonContent}>
                                                <Text style={[styles.applyButtonText, { color: theme.colors.textInverse }]}>تفعيل الكود</Text>
                                                <Ionicons name="arrow-forward-outline" size={20} color={theme.colors.textInverse} />
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleDismiss} style={styles.skipButton}>
                                    <Text style={styles.skipButtonText}>ليس لدي كود حالياً</Text>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'center',
        padding: 24,
    },
    keyboardView: {
        width: '100%',
    },
    modalContainer: {
        width: '100%',
        borderRadius: 32,
        overflow: 'hidden',
        ...getPlatformShadow('xl'),
    },
    gradient: {
        padding: 28,
        width: '100%',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        padding: 8,
        zIndex: 10,
    },
    content: {
        width: '100%',
        alignItems: 'center',
        marginTop: 10,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: theme.colors.primary + '33',
    },
    title: {
        fontSize: 24,
        fontWeight: getPlatformFontWeight('900'),
        color: theme.colors.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily,
    },
    subtitle: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        fontFamily: theme.typography.fontFamily,
        paddingHorizontal: 10,
    },
    inputWrapper: {
        width: '100%',
        marginBottom: 24,
    },
    input: {
        width: '100%',
        backgroundColor: theme.colors.background,
        borderRadius: 20,
        paddingHorizontal: 16,
        height: 60,
        fontSize: 18,
        color: theme.colors.textPrimary,
        fontWeight: getPlatformFontWeight('800'),
        fontFamily: theme.typography.fontFamily,
        borderWidth: 2,
        borderColor: theme.colors.border,
    },
    applyButton: {
        width: '100%',
        height: 60,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
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
    skipButton: {
        padding: 8,
    },
    skipButtonText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: getPlatformFontWeight('600'),
        fontFamily: theme.typography.fontFamily,
    },
});
