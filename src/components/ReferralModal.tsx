import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { type AppTheme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme-constants';
import { referralService } from '../services/referralService';
import { isRTL } from '../utils/rtl';
import { AppBottomSheet, AppButton, AppInput } from '../design-system';
import { LinearGradient } from 'expo-linear-gradient';


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
    const [error, setError] = useState<string | null>(null);

    const handleApply = async () => {
        setError(null);
        if (!code.trim()) {
            setError('يرجى إدخال كود الإحالة');
            return;
        }

        setLoading(true);
        try {
            const result = await referralService.applyCode(code.trim());
            if (result.success) {
                // Success alert is handled by the parent components (ProfileScreen)
                onSuccess(result.data?.rewardDays || 7);
                setError(null);
                onClose();
            } else {
                const errorMessage = typeof result.error === 'string' ? result.error : 'كود الإحالة غير صحيح';
                setError(errorMessage);
            }
        } catch (err) {
            setError('حدث خطأ أثناء تفعيل الكود، يرجى المحاولة لاحقاً');
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async () => {
        await referralService.markDismissed();
        onClose();
    };

    return (
        <AppBottomSheet
            visible={visible}
            onClose={handleDismiss}
            title="لديك كود إحالة؟"
            avoidKeyboard
        >
            <View style={styles.content}>
                <View style={styles.iconWrapper}>
                    <LinearGradient
                        colors={[theme.colors.primary + '15', theme.colors.primary + '30'] as any}
                        style={styles.iconContainer}
                    >
                        <Ionicons name="gift" size={50} color={theme.colors.primary} />
                    </LinearGradient>
                    <View style={[styles.iconPulse, { borderColor: theme.colors.primary + '10' }]} />
                </View>

                <Text style={styles.subtitle}>
                    أدخل كود الإحالة الذي حصلت عليه من صديقك ليحصل كل منكما على 7 أيام اشتراك "برو" مجاناً!
                </Text>

                <View style={styles.inputWrapper}>
                    <AppInput
                        value={code}
                        onChangeText={(text) => {
                            setCode(text.toUpperCase());
                            if (error) setError(null);
                        }}
                        placeholder="مثال: DN-A7BC12"
                        error={error || undefined}
                    />
                </View>

                <View style={styles.actions}>
                    <AppButton
                        label="تفعيل الكود"
                        onPress={handleApply}
                        loading={loading}
                        variant="primary"
                        rightIcon="flash-outline"
                        style={styles.actionButton}
                    />

                    <AppButton
                        label="ليس لدي كود حالياً"
                        onPress={handleDismiss}
                        variant="ghost"
                        style={styles.skipButton}
                    />
                </View>
            </View>
        </AppBottomSheet>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    content: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingBottom: 8,
    },
    iconWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        marginTop: 8,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
        borderWidth: 1,
        borderColor: theme.colors.primary + '33',
    },
    iconPulse: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1,
        zIndex: 1,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
        fontFamily: theme.typography.fontFamily,
        paddingHorizontal: 20,
    },
    inputWrapper: {
        width: '100%',
        marginBottom: 32,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    actionButton: {
        width: '100%',
    },
    skipButton: {
        width: '100%',
        marginTop: 4,
    },
});
