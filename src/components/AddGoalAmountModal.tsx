import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { FinancialGoal, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { formatCurrencyAmount } from '../services/currencyService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';

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
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <Pressable
                    style={styles.overlay}
                    onPress={handleClose}
                >
                    <Pressable
                        style={styles.modalContainer}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <LinearGradient
                            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                            style={styles.modalGradient}
                        >
                            <View style={styles.header}>
                                <View style={styles.headerText}>
                                    <Text style={styles.title}>إضافة للهدف</Text>
                                    <Text style={styles.subtitle}>سجل مبلغاً جديداً تم توفيره لهذا الهدف</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={handleClose}
                                    style={styles.closeButton}
                                >
                                    <Ionicons name="close" size={22} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

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
                                <TouchableOpacity
                                    onPress={handleClose}
                                    style={styles.cancelButton}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelButtonText}>إلغاء</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleAdd}
                                    disabled={loading || !amount || Number(amount.replace(/,/g, '')) <= 0}
                                    style={[
                                        styles.addButton,
                                        (loading || !amount || Number(amount.replace(/,/g, '')) <= 0) && styles.addButtonDisabled,
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={theme.gradients.success as any}
                                        style={styles.addButtonGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        {loading ? (
                                            <Text style={styles.addButtonText}>جاري الحفظ...</Text>
                                        ) : (
                                            <>
                                                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                                                <Text style={styles.addButtonText}>تأكيد الإضافة</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.sm,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 380,
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        ...getPlatformShadow('lg'),
    },
    modalGradient: {
        padding: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
    },
    header: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.sm,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: theme.typography.sizes.lg,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 2,
        textAlign: 'right',
    },
    subtitle: {
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'right',
    },
    closeButton: {
        padding: theme.spacing.xs,
    },
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
        paddingVertical: theme.spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.borderRadius.sm,
        backgroundColor: theme.colors.surfaceLight,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cancelButtonText: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
    },
    addButton: {
        flex: 1.4,
        borderRadius: theme.borderRadius.sm,
        overflow: 'hidden',
        ...getPlatformShadow('sm'),
    },
    addButtonDisabled: {
        opacity: 0.5,
    },
    addButtonGradient: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.xs,
    },
    addButtonText: {
        fontSize: theme.typography.sizes.sm,
        fontWeight: getPlatformFontWeight('700'),
        color: '#FFFFFF',
        fontFamily: theme.typography.fontFamily,
    },
});
