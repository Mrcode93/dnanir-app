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
                <View
                    style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '15' }]}
                >
                    <Ionicons name="gift" size={50} color={theme.colors.primary} />
                </View>

                <Text style={styles.subtitle}>
                    أدخل كود الإحالة الذي حصلت عليه من صديقك لتحصل أنت وهو على 7 أيام اشتراك "برو" مجاناً!
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

                <AppButton
                    label="تفعيل الكود"
                    onPress={handleApply}
                    loading={loading}
                    variant="primary"
                    rightIcon="arrow-forward-outline"
                />

                <AppButton
                    label="ليس لدي كود حالياً"
                    onPress={handleDismiss}
                    variant="ghost"
                    style={styles.skipButton}
                />
            </View>
        </AppBottomSheet>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    content: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 8,
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
    skipButton: {
        marginTop: 8,
    },
});
