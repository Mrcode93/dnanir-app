import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, useAppTheme, useThemedStyles } from '../utils/theme';
import { FinancialGoal, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { formatCurrencyAmount } from '../services/currencyService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { AppDialog, AppButton } from '../design-system';

interface AddGoalAmountModalProps {
    visible: boolean;
    goal: FinancialGoal | null;
    onClose: () => void;
    onAdd: (amount: number) => Promise<void>;
}

export const AddGoalAmountModal: React.FC<AddGoalAmountModalProps> = ({
    visible,
    goal,
    onClose,
    onAdd,
}) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const { formatCurrency, currencyCode } = useCurrency();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            setAmount('');
        }
    }, [visible]);

    const handleAdd = async () => {
        if (!goal) return;

        Keyboard.dismiss();

        const cleanAmount = amount.replace(/,/g, '');
        const addAmount = Number(cleanAmount);

        if (!cleanAmount.trim() || isNaN(addAmount) || addAmount <= 0) {
            alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
            return;
        }

        const remaining = goal.targetAmount - goal.currentAmount;
        if (addAmount > remaining) {
            // Allow over-saving if they want, but show a confirmation
            alertService.show({
                title: 'تنبيه',
                message: `المبلغ المدخل (${formatCurrency(addAmount)}) أكبر من المبلغ المتبقي (${formatCurrency(remaining)}). هل تريد الاستمرار؟`,
                confirmText: 'استمرار',
                cancelText: 'إلغاء',
                showCancel: true,
                onConfirm: async () => {
                    await executeAdd(addAmount);
                }
            });
            return;
        }

        await executeAdd(addAmount);
    };

    const executeAdd = async (amountNum: number) => {
        setLoading(true);
        try {
            await onAdd(amountNum);
            setAmount('');
            onClose();
        } catch (error) {

        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setAmount('');
        onClose();
    };

    if (!goal) return null;

    const goalCurrency = goal.currency || currencyCode;
    const currencyInfo = CURRENCIES.find(c => c.code === goalCurrency);
    const remaining = goal.targetAmount - goal.currentAmount;

    return (
        <AppDialog
            visible={visible}
            onClose={handleClose}
            title="إضافة للهدف"
            subtitle="سجل مبلغاً جديداً تم توفيره لهذا الهدف"
        >
            <View style={styles.goalInfo}>
                <View style={styles.goalRow}>
                    <Text style={styles.goalLabel}>الهدف</Text>
                    <Text style={styles.goalValue} numberOfLines={1}>{goal.title}</Text>
                </View>
                <View style={styles.goalRow}>
                    <Text style={styles.goalLabel}>المتبقي</Text>
                    <Text style={[styles.goalValue, styles.remainingAmount]}>
                        {formatCurrencyAmount(remaining, goalCurrency)}
                    </Text>
                </View>
            </View>

            <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>المبلغ المراد إضافته</Text>
                <View style={styles.amountInputWrapper}>
                    <TextInput
                        value={amount}
                        onChangeText={(val) => {
                            const cleaned = convertArabicToEnglish(val);
                            setAmount(formatNumberWithCommas(cleaned));
                        }}
                        placeholder="0.00"
                        keyboardType="numeric"
                        style={styles.amountInput}
                        placeholderTextColor={theme.colors.textMuted}
                        autoFocus
                    />
                    <Text style={styles.currencyText}>
                        {currencyInfo?.symbol || goalCurrency}
                    </Text>
                </View>
            </View>

            <View style={styles.actions}>
                <AppButton
                    label="إلغاء"
                    onPress={handleClose}
                    variant="secondary"
                    style={styles.cancelButton}
                />
                <AppButton
                    label={loading ? 'جاري الحفظ...' : 'تأكيد الإضافة'}
                    onPress={handleAdd}
                    variant="success"
                    loading={loading}
                    disabled={loading || !amount || Number(amount.replace(/,/g, '')) <= 0}
                    leftIcon="add-circle"
                    style={styles.addButton}
                />
            </View>
        </AppDialog>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    goalInfo: {
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: theme.borderRadius.sm,
        padding: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
        gap: 6,
    },
    goalRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    goalLabel: {
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        minWidth: 70,
        textAlign: 'right',
    },
    goalValue: {
        fontSize: theme.typography.sizes.md,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        flex: 1,
        textAlign: 'left',
    },
    remainingAmount: {
        fontSize: theme.typography.sizes.lg,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.error,
    },
    amountContainer: {
        marginBottom: theme.spacing.md,
    },
    amountLabel: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: theme.spacing.xs,
        textAlign: isRTL ? 'right' : 'left',
    },
    amountInputWrapper: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: theme.borderRadius.sm,
        paddingHorizontal: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    amountInput: {
        flex: 1,
        fontSize: theme.typography.sizes.xl,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        paddingVertical: theme.spacing.sm,
        textAlign: 'right',
    },
    currencyText: {
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        marginLeft: isRTL ? 0 : theme.spacing.xs,
        marginRight: isRTL ? theme.spacing.xs : 0,
    },
    actions: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.sm,
        paddingTop: theme.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    cancelButton: {
        flex: 1,
    },
    addButton: {
        flex: 1.4,
    },
});
