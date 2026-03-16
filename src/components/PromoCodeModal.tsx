import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { type AppTheme, getPlatformFontWeight, getPlatformShadow } from '../utils/theme-constants';
import { isRTL } from '../utils/rtl';
import { promoService } from '../services/promoService';
import { alertService } from '../services/alertService';
import { AppBottomSheet, AppButton, AppInput } from '../design-system';

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
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            title="كود البرومو"
            avoidKeyboard
        >
            <View style={styles.header}>
                <LinearGradient
                    colors={['rgba(212, 175, 55, 0.2)', 'rgba(212, 175, 55, 0.05)']}
                    style={styles.iconWrapper}
                >
                    <Ionicons name="gift" size={36} color="#D4AF37" />
                </LinearGradient>
                <Text style={styles.subtitle}>أدخل الكود للحصول على مميزات اشتراك "برو" مجانية</Text>
            </View>

            <View style={styles.inputContainer}>
                <AppInput
                    value={code}
                    onChangeText={(text) => {
                        setCode(text.toUpperCase());
                        if (error) setError(null);
                    }}
                    placeholder="أدخل الكود هنا (مثال: FREE30)"
                    icon="ticket-outline"
                    error={error || undefined}
                />
            </View>

            <View style={styles.actions}>
                <AppButton
                    label="تفعيل الآن"
                    onPress={handleApply}
                    variant="primary"
                    loading={loading}
                    disabled={loading}
                    rightIcon="checkmark-circle-outline"
                />

                <AppButton
                    label="إلغاء"
                    onPress={onClose}
                    variant="ghost"
                    disabled={loading}
                />
            </View>
        </AppBottomSheet>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    header: {
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
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
    subtitle: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        fontFamily: theme.typography.fontFamily,
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    inputContainer: {
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    actions: {
        paddingHorizontal: 16,
        gap: 16,
        paddingBottom: 8,
    },
});
