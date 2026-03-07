import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Animated,
    Pressable,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { FinancialGoal, GOAL_CATEGORIES, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { usePrivacy } from '../context/PrivacyContext';
import { ConfirmAlert } from './ConfirmAlert';

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
    const insets = useSafeAreaInsets();
    const { formatCurrency, currencyCode } = useCurrency();
    const { isPrivacyEnabled } = usePrivacy();
    const [slideAnim] = useState(new Animated.Value(0));
    const [showConfirmAlert, setShowConfirmAlert] = useState(false);
    const [convertedCurrent, setConvertedCurrent] = useState<number | null>(null);
    const [convertedTarget, setConvertedTarget] = useState<number | null>(null);

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }).start();
        } else {
            slideAnim.setValue(0);
        }
    }, [visible]);

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

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [600, 0],
    });

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Animated.View
                    style={[
                        styles.modalContainer,
                        { transform: [{ translateY }] },
                    ]}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                            {/* Drag Handle */}
                            <View style={styles.dragHandle} />

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
                                <TouchableOpacity onPress={onClose} style={styles.heroCloseBtn}>
                                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
                                </TouchableOpacity>
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
                                    <TouchableOpacity
                                        style={styles.addAmountBtn}
                                        onPress={() => { onClose(); setTimeout(() => onAddAmount(), 300); }}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={theme.gradients.success as any}
                                            style={styles.addAmountGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        >
                                            <Ionicons name="add-circle" size={22} color="#FFFFFF" />
                                            <Text style={styles.addAmountText}>إضافة مبلغ للهدف</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}

                                {onPlan && (
                                    <TouchableOpacity
                                        style={styles.aiPlanBtn}
                                        onPress={() => { onClose(); setTimeout(() => onPlan(), 300); }}
                                        activeOpacity={0.8}
                                    >
                                        <LinearGradient
                                            colors={theme.gradients.primary as any}
                                            style={styles.aiPlanGradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                        >
                                            <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                                            <Text style={styles.aiPlanText}>خطة الذكاء الاصطناعي</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Action Buttons Row 2: Secondary Actions */}
                            <View style={styles.secondaryActions}>
                                {onEdit && (
                                    <TouchableOpacity
                                        style={styles.secondaryActionBtn}
                                        onPress={() => { onClose(); setTimeout(() => onEdit(), 300); }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.secondaryActionIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                                        </View>
                                        <Text style={[styles.secondaryActionText, { color: theme.colors.primary }]}>تعديل</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={styles.secondaryActionBtn}
                                    onPress={handleDelete}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.secondaryActionIcon, { backgroundColor: theme.colors.error + '15' }]}>
                                        <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                                    </View>
                                    <Text style={[styles.secondaryActionText, { color: theme.colors.error }]}>حذف</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>

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
        </Modal>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: theme.colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        maxHeight: '90%',
        width: '100%',
    },
    modalContent: {
        backgroundColor: theme.colors.surfaceCard,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: theme.colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
        opacity: 0.5,
    },
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
    heroCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
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
        maxHeight: 250,
    },
    detailsScrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 8,
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
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 14,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
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
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
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
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 10,
    },
    addAmountBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        ...getPlatformShadow('sm'),
    },
    addAmountGradient: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    addAmountText: {
        fontSize: 16,
        fontWeight: getPlatformFontWeight('700'),
        color: '#FFFFFF',
        fontFamily: theme.typography.fontFamily,
    },
    aiPlanBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        ...getPlatformShadow('sm'),
    },
    aiPlanGradient: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    aiPlanText: {
        fontSize: 16,
        fontWeight: getPlatformFontWeight('700'),
        color: '#FFFFFF',
        fontFamily: theme.typography.fontFamily,
    },
    secondaryActions: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        paddingHorizontal: 16,
        paddingBottom: 8,
        gap: 12,
    },
    secondaryActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: theme.colors.surface,
        ...getPlatformShadow('xs'),
        gap: 8,
    },
    secondaryActionIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryActionText: {
        fontSize: 14,
        fontWeight: getPlatformFontWeight('700'),
        fontFamily: theme.typography.fontFamily,
    },
});
