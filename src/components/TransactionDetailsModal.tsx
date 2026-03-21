import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Expense, Income, IncomeSource, INCOME_SOURCES, ExpenseCategory, EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { CustomCategory } from '../database/database';
import { usePrivacy } from '../context/PrivacyContext';
import { ConfirmAlert } from './ConfirmAlert';
import { resolveIoniconName } from '../utils/icon-utils';
import { alertService } from '../services/alertService';
import { AppBottomSheet, AppButton } from '../design-system';

interface TransactionDetailsModalProps {
    visible: boolean;
    item: (Expense | Income) | null;
    type: 'expense' | 'income';
    onClose: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    customCategories?: CustomCategory[];
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
    visible,
    item,
    type,
    onClose,
    onEdit,
    onDelete,
    customCategories = [],
}) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const { formatCurrency, currencyCode } = useCurrency();
    const { isPrivacyEnabled } = usePrivacy();
    const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const isExpense = type === 'expense';
    const expense = isExpense ? (item as Expense) : null;
    const income = !isExpense ? (item as Income) : null;

    // Convert currency if needed
    useEffect(() => {
        const convert = async () => {
            if (!item) return;
            const itemCurrency = (item as any).currency || currencyCode;
            if (itemCurrency !== currencyCode) {
                try {
                    const converted = await convertCurrency(item.amount, itemCurrency, currencyCode);
                    setConvertedAmount(converted);
                } catch {
                    setConvertedAmount(null);
                }
            } else {
                setConvertedAmount(null);
            }
        };
        convert();
    }, [item, currencyCode]);

    if (!item) return null;

    const itemCurrency = (item as any).currency || currencyCode;
    const currencyInfo = CURRENCIES.find(c => c.code === itemCurrency);

    // Get category info
    const getCategoryInfo = () => {
        if (isExpense) {
            const category = expense?.category;
            if (!category) return { icon: 'ellipse', colors: ['#6B7280', '#4B5563'], label: 'أخرى' };

            const customCat = customCategories.find(c => c.name === category);
            if (customCat) {
                return {
                    icon: resolveIoniconName(customCat.icon, 'ellipse'),
                    colors: [customCat.color, customCat.color],
                    label: customCat.name
                };
            }

            const defaultKey = Object.keys(EXPENSE_CATEGORIES).find(
                key => EXPENSE_CATEGORIES[key as ExpenseCategory] === category || key === category
            ) as ExpenseCategory;

            if (defaultKey) {
                const iconMap: Record<string, string> = {
                    food: 'restaurant', transport: 'car', shopping: 'bag', bills: 'receipt',
                    entertainment: 'musical-notes', health: 'medical', education: 'school', other: 'ellipse',
                };
                const colorMap: Record<string, string[]> = {
                    food: ['#F59E0B', '#D97706'], transport: ['#3B82F6', '#2563EB'], shopping: ['#EC4899', '#DB2777'],
                    bills: ['#EF4444', '#DC2626'], entertainment: ['#8B5CF6', '#7C3AED'], health: ['#10B981', '#059669'],
                    education: ['#06B6D4', '#0891B2'], other: ['#6B7280', '#4B5563'],
                };
                return {
                    icon: iconMap[defaultKey] || 'ellipse',
                    colors: colorMap[defaultKey] || ['#6B7280', '#4B5563'],
                    label: EXPENSE_CATEGORIES[defaultKey] || category,
                };
            }
            return { icon: 'ellipse', colors: ['#6B7280', '#4B5563'], label: category };
        } else {
            const source = income?.source;
            if (!source) return { icon: 'trending-up', colors: ['#10B981', '#059669'], label: '' };

            if (income?.category) {
                const categorySrc = income.category;
                const customCat = customCategories.find(c => c.name === categorySrc);
                if (customCat) {
                    return {
                        icon: resolveIoniconName(customCat.icon, 'ellipse'),
                        colors: [customCat.color, customCat.color],
                        label: customCat.name
                    };
                }

                const sourceIcons: Record<string, string> = {
                    salary: 'cash', business: 'briefcase', investment: 'trending-up', gift: 'gift', other: 'ellipse',
                };
                const sourceColors: Record<string, string[]> = {
                    salary: ['#10B981', '#059669'], business: ['#3B82F6', '#2563EB'], investment: ['#8B5CF6', '#7C3AED'],
                    gift: ['#EC4899', '#DB2777'], other: ['#6B7280', '#4B5563'],
                };

                if (INCOME_SOURCES[categorySrc as IncomeSource]) {
                    return {
                        icon: sourceIcons[categorySrc] || 'trending-up',
                        colors: sourceColors[categorySrc] || ['#10B981', '#059669'],
                        label: INCOME_SOURCES[categorySrc as IncomeSource] || source,
                    };
                }
            }

            const customCat = customCategories.find(c => c.name === source);
            if (customCat) {
                return {
                    icon: resolveIoniconName(customCat.icon, 'ellipse'),
                    colors: [customCat.color, customCat.color],
                    label: customCat.name
                };
            }

            return { icon: 'trending-up', colors: ['#10B981', '#059669'], label: source };
        }
    };

    const categoryInfo = getCategoryInfo();
    const categoryIcon = resolveIoniconName(categoryInfo.icon, 'ellipse');
    const title = isExpense ? (expense?.title || '') : (income?.source || '');
    const description = isExpense ? (expense?.description || '') : (income?.description || '');
    const date = new Date(item.date);
    const receiptImage = isExpense ? expense?.receipt_image_path : undefined;

    const formattedDate = date.toLocaleDateString('ar-IQ-u-nu-latn', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const formattedTime = date.toLocaleTimeString('ar-IQ-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const handleShare = async () => {
        try {
            const typeText = isExpense ? 'مصروف' : 'دخل';
            const amountText = formatCurrencyAmount(item.amount, itemCurrency);
            const message = `${typeText}: ${title}\nالمبلغ: ${amountText}\nالتاريخ: ${formattedDate}\n${description ? `ملاحظات: ${description}` : ''}\n\n— تطبيق دنانير`;
            await Share.share({ message });
        } catch { }
    };

    const handleDelete = () => {
        setIsConfirmingDelete(true);
    };

    const handleConfirmDeleteActual = () => {
        setIsConfirmingDelete(false);
        onDelete?.();
        onClose();
    };

    const handleCancelDelete = () => {
        setIsConfirmingDelete(false);
    };

    return (
        <>
            <AppBottomSheet
                visible={visible}
                onClose={onClose}
                maxHeight="90%"
            >
                {isConfirmingDelete ? (
                    <View style={styles.confirmContainer}>
                        <View style={[styles.confirmIconBg, { backgroundColor: theme.colors.error + '15' }]}>
                            <Ionicons name="trash-outline" size={44} color={theme.colors.error} />
                        </View>
                        <Text style={styles.confirmTitle}>تأكيد الحذف</Text>
                        <Text style={styles.confirmText}>
                            هل أنت متأكد من حذف {isExpense ? 'هذا المصروف' : 'هذا الدخل'}؟ لا يمكن التراجع عن هذا الإجراء.
                        </Text>
                        
                        <View style={styles.confirmActionsRow}>
                            <AppButton
                                label="إلغاء"
                                onPress={handleCancelDelete}
                                variant="secondary"
                                style={styles.actionBtnFlex}
                            />
                            <AppButton
                                label="تأكيد الحذف"
                                onPress={handleConfirmDeleteActual}
                                variant="danger"
                                style={styles.actionBtnFlex}
                            />
                        </View>
                    </View>
                ) : (
                    <>
                        {/* Hero Header */}
                        <LinearGradient
                            colors={categoryInfo.colors as any}
                            style={styles.heroHeader}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.heroIconContainer}>
                                <Ionicons name={categoryIcon} size={32} color="#FFFFFF" />
                            </View>
                            <View style={styles.heroInfo}>
                                <Text style={styles.heroTypeLabel}>
                                    {isExpense ? 'مصروف' : 'دخل'}
                                </Text>
                                <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.heroCloseBtn}>
                                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </LinearGradient>

                        {/* Amount Section */}
                        <View style={styles.amountSection}>
                            <View style={styles.amountRow}>
                                <Text style={[
                                    styles.amountValue,
                                    { color: isExpense ? theme.colors.error : theme.colors.success }
                                ]}>
                                    {isPrivacyEnabled
                                        ? '****'
                                        : `${isExpense ? '-' : '+'}${formatCurrencyAmount(item.amount, itemCurrency)}`}
                                </Text>
                                <View style={[styles.amountBadge, { backgroundColor: (isExpense ? theme.colors.error : theme.colors.success) + '15' }]}>
                                    <Text style={[styles.amountBadgeText, { color: isExpense ? theme.colors.error : theme.colors.success }]}>
                                        {currencyInfo?.symbol || itemCurrency}
                                    </Text>
                                </View>
                            </View>
                            {convertedAmount !== null && itemCurrency !== currencyCode && (
                                <Text style={styles.convertedAmount}>
                                    ≈ {isPrivacyEnabled ? '****' : formatCurrency(convertedAmount)}
                                </Text>
                            )}
                        </View>

                        <ScrollView
                            style={styles.detailsScroll}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.detailsScrollContent}
                        >
                            {/* Details Grid */}
                            <View style={styles.detailsGrid}>
                                {/* Category */}
                                <View style={styles.detailCard}>
                                    <View style={[styles.detailIconBg, { backgroundColor: categoryInfo.colors[0] + '15' }]}>
                                        <Ionicons name={categoryIcon} size={20} color={categoryInfo.colors[0]} />
                                    </View>
                                    <Text style={styles.detailLabel}>
                                        {isExpense ? 'الفئة' : 'المصدر'}
                                    </Text>
                                    <Text style={styles.detailValue} numberOfLines={1}>{categoryInfo.label}</Text>
                                </View>

                                {/* Date */}
                                <View style={styles.detailCard}>
                                    <View style={[styles.detailIconBg, { backgroundColor: theme.colors.info + '15' }]}>
                                        <Ionicons name="calendar" size={20} color={theme.colors.info} />
                                    </View>
                                    <Text style={styles.detailLabel}>التاريخ</Text>
                                    <Text style={styles.detailValue} numberOfLines={1}>
                                        {date.toLocaleDateString('ar-IQ-u-nu-latn', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                </View>

                                {/* Day of Week */}
                                <View style={styles.detailCard}>
                                    <View style={[styles.detailIconBg, { backgroundColor: theme.colors.primary + '15' }]}>
                                        <Ionicons name="today" size={20} color={theme.colors.primary} />
                                    </View>
                                    <Text style={styles.detailLabel}>اليوم</Text>
                                    <Text style={styles.detailValue} numberOfLines={1}>
                                        {date.toLocaleDateString('ar-IQ-u-nu-latn', { weekday: 'long' })}
                                    </Text>
                                </View>

                                {/* Currency */}
                                <View style={styles.detailCard}>
                                    <View style={[styles.detailIconBg, { backgroundColor: theme.colors.success + '15' }]}>
                                        <Ionicons name="cash" size={20} color={theme.colors.success} />
                                    </View>
                                    <Text style={styles.detailLabel}>العملة</Text>
                                    <Text style={styles.detailValue} numberOfLines={1}>
                                        {currencyInfo?.name || itemCurrency}
                                    </Text>
                                </View>
                            </View>

                            {/* Description */}
                            {description ? (
                                <View style={styles.descriptionSection}>
                                    <View style={styles.descriptionHeader}>
                                        <Ionicons name="document-text-outline" size={18} color={theme.colors.textSecondary} />
                                        <Text style={styles.descriptionLabel}>ملاحظات</Text>
                                    </View>
                                    <Text style={styles.descriptionText}>{description}</Text>
                                </View>
                            ) : null}

                            {/* Receipt Image Indicator - for expenses with receipt */}
                            {receiptImage ? (
                                <View style={styles.receiptSection}>
                                    <View style={styles.receiptIndicator}>
                                        <View style={[styles.detailIconBg, { backgroundColor: theme.colors.primary + '15' }]}>
                                            <Ionicons name="camera" size={20} color={theme.colors.primary} />
                                        </View>
                                        <Text style={styles.receiptText}>تم إرفاق صورة وصل</Text>
                                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                                    </View>
                                </View>
                            ) : null}
                            {/* Actions Grid */}
                            <View style={[styles.actionsGrid, { borderTopWidth: 0, marginTop: 24 }]}>
                                <View style={styles.actionRow}>
                                    <AppButton
                                        label="مشاركة"
                                        onPress={handleShare}
                                        variant="ghost"
                                        leftIcon="share-outline"
                                        style={styles.actionBtnFlex}
                                    />
                                    {onEdit && (
                                        <AppButton
                                            label="تعديل"
                                            onPress={() => { onClose(); setTimeout(() => onEdit(), 300); }}
                                            variant="secondary"
                                            leftIcon="create-outline"
                                            style={styles.actionBtnFlex}
                                        />
                                    )}
                                </View>

                                <View style={styles.actionRow}>
                                    {onDelete && (
                                        <AppButton
                                            label="حذف"
                                            onPress={handleDelete}
                                            variant="danger"
                                            leftIcon="trash-outline"
                                            style={styles.actionBtnFlex}
                                        />
                                    )}
                                </View>
                            </View>
                        </ScrollView>
                    </>
                )}
            </AppBottomSheet>
        </>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    // Hero Header
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

    // Amount
    amountSection: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    amountRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
    },
    amountValue: {
        fontSize: 32,
        fontWeight: getPlatformFontWeight('800'),
        fontFamily: theme.typography.fontFamily,
    },
    amountBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    amountBadgeText: {
        fontSize: 14,
        fontWeight: getPlatformFontWeight('700'),
        fontFamily: theme.typography.fontFamily,
    },
    convertedAmount: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        marginTop: 4,
    },

    // Details
    detailsScroll: {
        maxHeight: 300,
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

    // Description
    descriptionSection: {
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        ...getPlatformShadow('xs'),
    },
    descriptionHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    descriptionLabel: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
    },
    descriptionText: {
        fontSize: 14,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        lineHeight: 22,
        textAlign: isRTL ? 'right' : 'left',
    },

    // Receipt
    receiptSection: {
        marginBottom: 12,
    },
    receiptIndicator: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        padding: 14,
        gap: 12,
        ...getPlatformShadow('xs'),
    },
    receiptText: {
        flex: 1,
        fontSize: 14,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        fontWeight: getPlatformFontWeight('600'),
        textAlign: isRTL ? 'right' : 'left',
    },

    // Actions
    actionsGrid: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 20,
        gap: 12,
    },
    actionRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 12,
    },
    actionBtnFlex: {
        flex: 1,
    },
    // Confirmation UI
    confirmContainer: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 16,
    },
    confirmIconBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    confirmTitle: {
        fontSize: 22,
        fontWeight: getPlatformFontWeight('800'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 12,
        textAlign: 'center',
    },
    confirmText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    confirmActionsRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 12,
        width: '100%',
    },
});
