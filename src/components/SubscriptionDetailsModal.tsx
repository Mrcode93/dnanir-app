import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Share,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Subscription, SUBSCRIPTION_CATEGORIES, CURRENCIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { alertService } from '../services/alertService';
import { AppBottomSheet, AppButton } from '../design-system';
import { useWallets } from '../context/WalletContext';
import { tl } from "../localization";
import { markSubscriptionAsPaid } from '../database/database';

interface SubscriptionDetailsModalProps {
    visible: boolean;
    subscription: Subscription | null;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onStatusChange: () => void;
    customCategories?: any[];
}

export const SubscriptionDetailsModal: React.FC<SubscriptionDetailsModalProps> = ({
    visible,
    subscription,
    onClose,
    onEdit,
    onDelete,
    onStatusChange,
    customCategories = [],
}) => {
    const { theme, isDark } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const { formatCurrency, currencyCode } = useCurrency();
    const { wallets } = useWallets();
    const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const convert = async () => {
            if (!subscription) return;
            const itemCurrency = subscription.currency || currencyCode;
            if (itemCurrency !== currencyCode) {
                try {
                    const converted = await convertCurrency(subscription.amount, itemCurrency, currencyCode);
                    setConvertedAmount(converted);
                } catch {
                    setConvertedAmount(null);
                }
            } else {
                setConvertedAmount(null);
            }
        };
        convert();
    }, [subscription, currencyCode]);

    if (!subscription) return null;

    const getCategoryInfo = (cat: string) => {
        const predefined = SUBSCRIPTION_CATEGORIES[cat as keyof typeof SUBSCRIPTION_CATEGORIES];
        if (predefined) return predefined;
        const custom = customCategories.find(c => c.name === cat);
        if (custom) return { label: custom.name, icon: custom.icon, color: custom.color, library: 'Ionicons' as const };
        return SUBSCRIPTION_CATEGORIES.other;
    };

    const info = getCategoryInfo(subscription.category);
    const wallet = wallets.find(w => w.id === subscription.walletId);
    const itemCurrency = subscription.currency || currencyCode;
    const currencyInfo = CURRENCIES.find(c => c.code === itemCurrency);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-IQ-u-nu-latn' : 'en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const handleShare = async () => {
        try {
            const amountText = formatCurrencyAmount(subscription.amount, itemCurrency);
            const message = `اشتراك: ${subscription.name}\nالمبلغ: ${amountText}\nالدورة: ${subscription.billingCycle === 'monthly' ? 'شهري' : subscription.billingCycle === 'yearly' ? 'سنوي' : 'أسبوعي'}\nالدفع القادم: ${subscription.nextPaymentDate}\n\n— تطبيق دنانير`;
            await Share.share({ message });
        } catch { }
    };

    const handleMarkAsPaid = async () => {
        setLoading(true);
        try {
            await markSubscriptionAsPaid(subscription.id);
            alertService.toastSuccess(tl("تم تسجيل الدفع وتحديث الموعد القادم"));
            onStatusChange();
            onClose();
        } catch (error) {
            alertService.error(tl("خطأ"), tl("حدث خطأ أثناء تسجيل الدفع"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppBottomSheet
            visible={visible}
            onClose={onClose}
            height="80%"
        >
            {/* Header / Hero */}
            <LinearGradient
                colors={[info.color, info.color + 'CC']}
                style={styles.heroHeader}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.heroIconContainer}>
                    {info.library === 'Ionicons' ? (
                        <Ionicons name={info.icon as any} size={32} color="#FFFFFF" />
                    ) : (
                        <MaterialCommunityIcons name={info.icon as any} size={32} color="#FFFFFF" />
                    )}
                </View>
                <View style={styles.heroInfo}>
                    <Text style={styles.heroTypeLabel}>{tl("اشتراك رقمي")}</Text>
                    <Text style={styles.heroTitle} numberOfLines={2}>{subscription.name}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.heroCloseBtn}>
                    <Ionicons name="close" size={22} color="#FFFFFF" />
                </TouchableOpacity>
            </LinearGradient>

            {/* Amount Section */}
            <View style={styles.amountSection}>
                <View style={styles.amountRow}>
                    <Text style={styles.amountValue}>
                        {formatCurrencyAmount(subscription.amount, itemCurrency)}
                    </Text>
                    <View style={[styles.amountBadge, { backgroundColor: info.color + '15' }]}>
                        <Text style={[styles.amountBadgeText, { color: info.color }]}>
                            {currencyInfo?.symbol || itemCurrency}
                        </Text>
                    </View>
                </View>
                {convertedAmount !== null && (
                    <Text style={styles.convertedAmount}>
                        ≈ {formatCurrency(convertedAmount)}
                    </Text>
                )}
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Info Grid */}
                <View style={styles.grid}>
                    <View style={styles.gridItem}>
                        <View style={[styles.gridIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                            <Ionicons name="repeat" size={20} color={theme.colors.primary} />
                        </View>
                        <Text style={styles.gridLabel}>{tl("دورة الفوترة")}</Text>
                        <Text style={styles.gridValue}>
                            {subscription.billingCycle === 'monthly' ? tl("شهري") : subscription.billingCycle === 'yearly' ? tl("سنوي") : tl("أسبوعي")}
                        </Text>
                    </View>

                    <View style={styles.gridItem}>
                        <View style={[styles.gridIcon, { backgroundColor: theme.colors.info + '15' }]}>
                            <Ionicons name="calendar" size={20} color={theme.colors.info} />
                        </View>
                        <Text style={styles.gridLabel}>{tl("الدفع القادم")}</Text>
                        <Text style={styles.gridValue}>{subscription.nextPaymentDate}</Text>
                    </View>

                    <View style={styles.gridItem}>
                        <View style={[styles.gridIcon, { backgroundColor: info.color + '15' }]}>
                            <Ionicons name="apps" size={20} color={info.color} />
                        </View>
                        <Text style={styles.gridLabel}>{tl("الفئة")}</Text>
                        <Text style={styles.gridValue}>{info.label}</Text>
                    </View>

                    <View style={styles.gridItem}>
                        <View style={[styles.gridIcon, { backgroundColor: theme.colors.success + '15' }]}>
                            <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
                        </View>
                        <Text style={styles.gridLabel}>{tl("الحالة")}</Text>
                        <Text style={[styles.gridValue, { color: subscription.isActive ? theme.colors.success : theme.colors.textMuted }]}>
                            {subscription.isActive ? tl("نشط") : tl("متوقف")}
                        </Text>
                    </View>
                </View>

                {wallet && (
                    <View style={styles.walletSection}>
                        <View style={[styles.gridIcon, { backgroundColor: (wallet.color || theme.colors.primary) + '15' }]}>
                            <Ionicons name={(wallet.icon as any) || 'wallet'} size={20} color={wallet.color || theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginHorizontal: 12 }}>
                            <Text style={styles.gridLabel}>{tl("المحفظة المستخدمة")}</Text>
                            <Text style={styles.gridValue}>{wallet.name}</Text>
                        </View>
                    </View>
                )}

                {subscription.description && (
                    <View style={styles.descriptionBox}>
                        <Text style={styles.descriptionLabel}>{tl("ملاحظات")}</Text>
                        <Text style={styles.descriptionText}>{subscription.description}</Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                    {subscription.isActive && (
                        <AppButton
                            label={tl("تم دفع هذا الشهر")}
                            onPress={handleMarkAsPaid}
                            variant="primary"
                            leftIcon="checkmark-circle"
                            loading={loading}
                            style={{ marginBottom: 12 }}
                        />
                    )}
                    
                    <View style={styles.secondaryActions}>
                        <AppButton
                            label={tl("تعديل")}
                            onPress={onEdit}
                            variant="secondary"
                            leftIcon="create-outline"
                            style={{ flex: 1 }}
                        />
                        <AppButton
                            label={tl("حذف")}
                            onPress={onDelete}
                            variant="danger"
                            leftIcon="trash-outline"
                            style={{ flex: 1 }}
                        />
                    </View>

                    <AppButton
                        label={tl("مشاركة")}
                        onPress={handleShare}
                        variant="ghost"
                        leftIcon="share-outline"
                        style={{ marginTop: 8 }}
                    />
                </View>
            </ScrollView>
        </AppBottomSheet>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    heroHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        padding: 20,
        marginHorizontal: 16,
        borderRadius: 24,
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
        color: 'rgba(255,255,255,0.8)',
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
        marginBottom: 2,
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
    amountSection: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    amountRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
    },
    amountValue: {
        fontSize: 34,
        fontWeight: getPlatformFontWeight('900'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
    },
    amountBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
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
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    gridItem: {
        width: '48%',
        backgroundColor: theme.colors.surface,
        borderRadius: 18,
        padding: 16,
        ...getPlatformShadow('xs'),
    },
    gridIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    gridLabel: {
        fontSize: 11,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 2,
        textAlign: isRTL ? 'right' : 'left',
    },
    gridValue: {
        fontSize: 14,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    walletSection: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        ...getPlatformShadow('xs'),
    },
    descriptionBox: {
        backgroundColor: theme.colors.surface,
        borderRadius: 18,
        padding: 16,
        marginBottom: 24,
        ...getPlatformShadow('xs'),
    },
    descriptionLabel: {
        fontSize: 13,
        fontWeight: getPlatformFontWeight('600'),
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 6,
        textAlign: isRTL ? 'right' : 'left',
    },
    descriptionText: {
        fontSize: 14,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        lineHeight: 22,
        textAlign: isRTL ? 'right' : 'left',
    },
    actions: {
        paddingBottom: 40,
    },
    secondaryActions: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: 12,
    }
});
