import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { FinancialGoal, GOAL_CATEGORIES, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { usePrivacy } from '../context/PrivacyContext';
import { ConfirmAlert } from './ConfirmAlert';
import { AppBottomSheet, AppButton } from '../design-system';

interface GoalDetailsModalProps {
    visible: boolean;
    goal: FinancialGoal | null;
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onPlan?: () => void;
    onAddAmount?: () => void;
    estimatedTime?: string | null;
}

export const GoalDetailsModal: React.FC<GoalDetailsModalProps> = ({
    visible,
    goal,
    onClose,
    onEdit,
    onDelete,
    onPlan,
    onAddAmount,
    estimatedTime,
}) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const { formatCurrency, currencyCode } = useCurrency();
    const { isPrivacyEnabled } = usePrivacy();
    const [showConfirmAlert, setShowConfirmAlert] = useState(false);
    const [convertedCurrent, setConvertedCurrent] = useState<number | null>(null);
    const [convertedTarget, setConvertedTarget] = useState<number | null>(null);

    useEffect(() => {
        const convert = async () => {
            if (!goal) return;
            const goalCurrency = goal.currency || currencyCode;
            if (goalCurrency !== currencyCode) {
                try {
                    const current = await convertCurrency(goal.currentAmount, goalCurrency, currencyCode);
                    const target = await convertCurrency(goal.targetAmount, goalCurrency, currencyCode);
                    setConvertedCurrent(current);
                    setConvertedTarget(target);
                } catch {
                    setConvertedCurrent(null);
                    setConvertedTarget(null);
                }
            } else {
                setConvertedCurrent(null);
                setConvertedTarget(null);
            }
        };
        convert();
    }, [goal, currencyCode]);

    if (!goal) return null;

    const goalCurrency = goal.currency || currencyCode;
    const currencyInfo = CURRENCIES.find(c => c.code === goalCurrency);
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const isCompleted = goal.completed || progress >= 100;
    const categoryInfo = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.other;

    const getCategoryColors = () => {
        if (isCompleted) return theme.gradients.success;
        const colorMap: Record<string, readonly string[]> = {
            emergency: theme.gradients.goalRose,
            vacation: theme.gradients.goalBlue,
            car: theme.gradients.goalOrange,
            house: theme.gradients.goalIndigo,
            wedding: theme.gradients.goalPink,
            education: theme.gradients.goalTeal,
            business: theme.gradients.goalEmerald,
            other: theme.gradients.goalPurple,
        };
        return colorMap[goal.category] || theme.gradients.goalPurple;
    };

    const categoryColors = getCategoryColors();

    const handleDelete = () => {
        setShowConfirmAlert(true);
    };

    const handleConfirmDelete = () => {
        setShowConfirmAlert(false);
        onDelete?.();
        onClose();
    };

    return (
        <>
            <AppBottomSheet
                visible={visible}
                onClose={onClose}
                maxHeight="90%"
            >
                {/* Hero Header */}
                <LinearGradient
                    colors={categoryColors as any}
                    style={styles.heroHeader}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.heroIconContainer}>
                        <Ionicons name={categoryInfo.icon as any} size={32} color="#FFFFFF" />
                    </View>
                    <View style={styles.heroInfo}>
                        <Text style={styles.heroTypeLabel}>هدف مالي</Text>
                        <Text style={styles.heroTitle} numberOfLines={2}>{goal.title}</Text>
                    </View>
                </LinearGradient>

                {/* Progress Section */}
                <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>التقدم الحالي</Text>
                        <Text style={styles.progressPercent}>
                            {isPrivacyEnabled ? '**%' : `${Math.round(progress)}%`}
                        </Text>
                    </View>
                    <View style={styles.progressBar}>
                        <LinearGradient
                            colors={['#FFFFFF', '#FFFFFF']}
                            style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: categoryColors[0] }]}
                        />
                    </View>
                </View>

                <ScrollView
                    style={styles.detailsScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.detailsScrollContent}
                >
                    {/* Amounts Grid */}
                    <View style={styles.detailsGrid}>
                        {/* المحقق */}
                        <View style={styles.detailCard}>
                            <View style={[styles.detailIconBg, { backgroundColor: theme.colors.success + '15' }]}>
                                <Ionicons name="cash" size={20} color={theme.colors.success} />
                            </View>
                            <Text style={styles.detailLabel}>المحقق</Text>
                            <Text style={styles.detailValue} numberOfLines={1}>
                                {isPrivacyEnabled ? '****' : formatCurrencyAmount(goal.currentAmount, goalCurrency)}
                            </Text>
                            {convertedCurrent !== null && goalCurrency !== currencyCode && (
                                <Text style={styles.convertedText}>≈ {formatCurrency(convertedCurrent)}</Text>
                            )}
                        </View>

                        {/* المستهدف */}
                        <View style={styles.detailCard}>
                            <View style={[styles.detailIconBg, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Ionicons name="flag" size={20} color={theme.colors.primary} />
                            </View>
                            <Text style={styles.detailLabel}>المستهدف</Text>
                            <Text style={styles.detailValue} numberOfLines={1}>
                                {isPrivacyEnabled ? '****' : formatCurrencyAmount(goal.targetAmount, goalCurrency)}
                            </Text>
                            {convertedTarget !== null && goalCurrency !== currencyCode && (
                                <Text style={styles.convertedText}>≈ {formatCurrency(convertedTarget)}</Text>
                            )}
                        </View>

                        {/* المتبقي */}
                        {!isCompleted && (
                            <View style={styles.detailCard}>
                                <View style={[styles.detailIconBg, { backgroundColor: theme.colors.error + '15' }]}>
                                    <Ionicons name="time" size={20} color={theme.colors.error} />
                                </View>
                                <Text style={styles.detailLabel}>المتبقي</Text>
                                <Text style={[styles.detailValue, { color: theme.colors.error }]} numberOfLines={1}>
                                    {isPrivacyEnabled ? '****' : formatCurrencyAmount(goal.targetAmount - goal.currentAmount, goalCurrency)}
                                </Text>
                            </View>
                        )}

                        {/* الفئة */}
                        <View style={styles.detailCard}>
                            <View style={[styles.detailIconBg, { backgroundColor: theme.colors.info + '15' }]}>
                                <Ionicons name={categoryInfo.icon as any} size={20} color={theme.colors.info} />
                            </View>
                            <Text style={styles.detailLabel}>الفئة</Text>
                            <Text style={styles.detailValue} numberOfLines={1}>{categoryInfo.label}</Text>
                        </View>
                    </View>

                    {/* Estimated Time */}
                    {estimatedTime && !isCompleted && (
                        <View style={styles.infoSection}>
                            <View style={styles.infoHeader}>
                                <Ionicons name="hourglass-outline" size={18} color={theme.colors.primary} />
                                <Text style={styles.infoLabel}>الوقت المتوقع لتحقيق الهدف</Text>
                            </View>
                            <Text style={styles.infoText}>{estimatedTime}</Text>
                        </View>
                    )}

                    {/* Description */}
                    {goal.description ? (
                        <View style={styles.infoSection}>
                            <View style={styles.infoHeader}>
                                <Ionicons name="document-text-outline" size={18} color={theme.colors.textSecondary} />
                                <Text style={styles.infoLabel}>ملاحظات</Text>
                            </View>
                            <Text style={styles.infoText}>{goal.description}</Text>
                        </View>
                    ) : null}
                </ScrollView>

                {/* Action Buttons Row 1: Main Actions */}
                <View style={styles.mainActions}>
                    {!isCompleted && onAddAmount && (
                        <AppButton
                            label="إضافة مبلغ للهدف"
                            onPress={() => { onClose(); setTimeout(() => onAddAmount(), 300); }}
                            variant="success"
                            leftIcon="add-circle"
                        />
                    )}

                    {onPlan && (
                        <AppButton
                            label="خطة الذكاء الاصطناعي"
                            onPress={() => { onClose(); setTimeout(() => onPlan(), 300); }}
                            variant="primary"
                            leftIcon="sparkles"
                        />
                    )}
                </View>

                {/* Action Buttons Row 2: Secondary Actions */}
                <View style={styles.secondaryActions}>
                    {onEdit && (
                        <AppButton
                            label="تعديل"
                            onPress={() => { onClose(); setTimeout(() => onEdit(), 300); }}
                            variant="secondary"
                            leftIcon="create-outline"
                            style={styles.actionBtnFlex}
                        />
                    )}

                    <AppButton
                        label="حذف"
                        onPress={handleDelete}
                        variant="danger"
                        leftIcon="trash-outline"
                        style={styles.actionBtnFlex}
                    />
                </View>
            </AppBottomSheet>

            <ConfirmAlert
                visible={showConfirmAlert}
                title="تأكيد الحذف"
                message="هل أنت متأكد من حذف هذا الهدف؟ لا يمكن التراجع عن هذا الإجراء."
                confirmText="حذف"
                cancelText="إلغاء"
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowConfirmAlert(false)}
                type="danger"
            />
        </>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    heroHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 20,
        marginHorizontal: 16,
        borderRadius: 20,
        marginBottom: 8,
    },
    heroIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: isRTL ? 16 : 0,
        marginRight: isRTL ? 0 : 16,
    },
    heroInfo: {
        flex: 1,
    },
    heroTypeLabel: {
        fontSize: 12,
        fontWeight: getPlatformFontWeight('600'),
        color: 'rgba(255,255,255,0.75)',
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
        marginBottom: 4,
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: getPlatformFontWeight('800'),
        color: '#FFFFFF',
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    progressSection: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    progressHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    progressLabel: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
    },
    progressPercent: {
        fontSize: 16,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('700'),
    },
    progressBar: {
        height: 12,
        backgroundColor: theme.colors.border + '50',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 6,
    },
    detailsScroll: {
        flexGrow: 0,
        flexShrink: 1,
    },
    detailsScrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    detailCard: {
        width: '48%',
        flexGrow: 1,
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: 16,
        padding: 14,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
        borderWidth: 1,
        borderColor: theme.colors.border + '20',
        ...getPlatformShadow('xs'),
    },
    detailIconBg: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 11,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 14,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('700'),
    },
    convertedText: {
        fontSize: 10,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamily,
        fontStyle: 'italic',
        marginTop: 2,
    },
    infoSection: {
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.colors.border + '20',
        ...getPlatformShadow('xs'),
    },
    infoHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
    },
    infoText: {
        fontSize: 14,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        lineHeight: 22,
        textAlign: isRTL ? 'right' : 'left',
    },
    mainActions: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 10,
    },
    secondaryActions: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 12,
    },
    actionBtnFlex: {
        flex: 1,
    },
});
