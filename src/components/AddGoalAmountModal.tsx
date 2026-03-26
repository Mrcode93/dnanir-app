import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, useAppTheme, useThemedStyles } from '../utils/theme';
import { FinancialGoal, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { AppDialog, AppButton } from '../design-system';
import { CurrencyPickerModal } from './CurrencyPickerModal';
import { TouchableOpacity } from 'react-native';

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
    
    const goalCurrency = goal?.currency || currencyCode;
    const [selectedCurrency, setSelectedCurrency] = useState(goalCurrency);
    const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
    const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

    useEffect(() => {
        if (visible && goal) {
            setAmount('');
            setSelectedCurrency(goal.currency || currencyCode);
        }
    }, [visible, goal, currencyCode]);

    useEffect(() => {
        const calculateConverted = async () => {
            const cleanAmount = amount.replace(/,/g, '');
            const numAmount = Number(cleanAmount);
            if (numAmount > 0 && selectedCurrency !== goalCurrency) {
                try {
                    const converted = await convertCurrency(numAmount, selectedCurrency, goalCurrency);
                    setConvertedAmount(converted);
                } catch (error) {
                    setConvertedAmount(null);
                }
            } else {
                setConvertedAmount(null);
            }
        };
        calculateConverted();
    }, [amount, selectedCurrency, goalCurrency]);

    const handleAdd = async () => {
        if (!goal) return;

        Keyboard.dismiss();

        const cleanAmount = amount.replace(/,/g, '');
        const addAmount = Number(cleanAmount);
        const finalAmount = convertedAmount !== null ? convertedAmount : addAmount;

        if (!cleanAmount.trim() || isNaN(addAmount) || addAmount <= 0) {
            alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
            return;
        }

        const remaining = goal.targetAmount - goal.currentAmount;
        if (finalAmount > remaining) {
            // Allow over-saving if they want, but show a confirmation
            alertService.show({
                title: 'تنبيه',
                message: `المبلغ المدخل (${formatCurrency((finalAmount))}) أكبر من المبلغ المتبقي (${formatCurrency(remaining)}). هل تريد الاستمرار؟`,
                confirmText: 'استمرار',
                cancelText: 'إلغاء',
                showCancel: true,
                onConfirm: async () => {
                    await executeAdd(addAmount);
                }
            });
            return;
        }

        await executeAdd(finalAmount);
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

    const currencyInfo = CURRENCIES.find(c => c.code === selectedCurrency);
    const remaining = goal.targetAmount - goal.currentAmount;

    return (
        <AppDialog
            visible={visible}
            onClose={handleClose}
            title="إضافة للهدف"
            subtitle="سجل مبلغاً جديداً تم توفيره لهذا الهدف"
        >
            <View style={styles.headerIconWrapper}>
                <LinearGradient
                    colors={[theme.colors.success + '15', theme.colors.success + '30'] as any}
                    style={styles.headerIconContainer}
                >
                    <Ionicons name="sparkles-outline" size={32} color={theme.colors.success} />
                </LinearGradient>
            </View>

            <View style={styles.goalInfoCard}>
                <View style={styles.goalInfoInner}>
                    <Text style={styles.goalInfoLabel}>الهدف النشط</Text>
                    <Text style={styles.goalInfoValue} numberOfLines={1}>{goal.title}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.goalInfoInner}>
                    <Text style={styles.goalInfoLabel}>المبلغ المتبقي</Text>
                    <Text style={styles.remainingValue}>
                        {formatCurrencyAmount(remaining, goalCurrency)}
                    </Text>
                </View>
            </View>

            <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>المبلغ المراد إضافته</Text>
                <View style={styles.inputWrapper}>
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
                    <TouchableOpacity onPress={() => setShowCurrencyPicker(true)} style={styles.currencyButton}>
                        <Text style={styles.currencySymbol}>
                            {currencyInfo?.symbol || selectedCurrency}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color={theme.colors.success} style={{marginLeft: 4}} />
                    </TouchableOpacity>
                </View>

                {convertedAmount !== null && selectedCurrency !== goalCurrency && (
                    <Text style={styles.convertedText}>
                        ≈ {formatCurrencyAmount(convertedAmount, goalCurrency)}
                    </Text>
                )}
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

            <CurrencyPickerModal
                visible={showCurrencyPicker}
                selectedCurrency={selectedCurrency}
                onSelect={(code) => {
                    setSelectedCurrency(code);
                    setShowCurrencyPicker(false);
                }}
                onClose={() => setShowCurrencyPicker(false)}
            />
        </AppDialog>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    headerIconWrapper: {
        marginBottom: theme.spacing.md,
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: theme.colors.success + '40',
    },
    goalInfoCard: {
        width: '100%',
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: theme.borderRadius.xxl,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border + '50',
    },
    goalInfoInner: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: theme.colors.border + '30',
        marginVertical: theme.spacing.sm,
    },
    goalInfoLabel: {
        fontSize: theme.typography.sizes.xs,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
    },
    goalInfoValue: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        maxWidth: '60%',
    },
    remainingValue: {
        fontSize: theme.typography.sizes.md,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.success,
        fontFamily: theme.typography.fontFamily,
    },
    inputSection: {
        width: '100%',
        marginBottom: theme.spacing.xl,
    },
    inputLabel: {
        fontSize: theme.typography.sizes.xs,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    inputWrapper: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: theme.borderRadius.xl,
        paddingHorizontal: theme.spacing.md,
        height: 64,
        borderWidth: 2,
        borderColor: theme.colors.success + '20',
    },
    amountInput: {
        flex: 1,
        fontSize: theme.typography.sizes.xxl + 4,
        fontWeight: getPlatformFontWeight('800'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'center',
    },
    currencyButton: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        backgroundColor: theme.colors.success + '15',
        borderRadius: theme.borderRadius.sm,
    },
    currencySymbol: {
        fontSize: theme.typography.sizes.md,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.success,
        fontFamily: theme.typography.fontFamily,
    },
    convertedText: {
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'center',
        marginTop: theme.spacing.xs,
        fontStyle: 'italic',
    },
    actions: {
        width: '100%',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.md,
    },
    cancelButton: {
        flex: 1,
    },
    addButton: {
        flex: 2,
    },
});
