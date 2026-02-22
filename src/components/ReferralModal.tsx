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
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { type AppTheme } from '../utils/theme-constants';
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
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.modalContainer}>
                        <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </TouchableOpacity>

                        <View style={styles.content}>
                            <View style={styles.iconContainer}>
                                <Ionicons name="gift" size={50} color={theme.colors.primary} />
                            </View>

                            <Text style={styles.title}>لديك كود إحالة؟</Text>
                            <Text style={styles.subtitle}>
                                أدخل كود الإحالة الذي حصلت عليه من صديقك لتحصل أنت وهو على 7 أيام اشتراك "برو" مجاناً!
                            </Text>

                            <TextInput
                                style={styles.input}
                                placeholder="مثال: DN-A7BC12"
                                placeholderTextColor="#94A3B8"
                                value={code}
                                onChangeText={setCode}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                textAlign="center"
                            />

                            <TouchableOpacity
                                style={styles.applyButton}
                                onPress={handleApply}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.applyButtonText}>تفعيل الكود</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleDismiss} style={styles.skipButton}>
                                <Text style={styles.skipButtonText}>ليس لدي كود حالياً</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    keyboardView: {
        width: '100%',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        left: 16,
        padding: 8,
        zIndex: 1,
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
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 12,
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily,
    },
    subtitle: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
        fontFamily: theme.typography.fontFamily,
    },
    input: {
        width: '100%',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        fontSize: 18,
        color: '#0F172A',
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    applyButton: {
        width: '100%',
        height: 56,
        backgroundColor: theme.colors.primary,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        fontFamily: theme.typography.fontFamily,
    },
    skipButton: {
        padding: 8,
    },
    skipButtonText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
        fontFamily: theme.typography.fontFamily,
    },
});
