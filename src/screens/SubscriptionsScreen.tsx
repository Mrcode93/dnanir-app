import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    RefreshControl,
    Text,
    TouchableOpacity,
    ScrollView,
    Platform,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getSubscriptions, deleteSubscription } from '../services/subscriptionService';
import { Subscription, SUBSCRIPTION_CATEGORIES, SubscriptionCategory } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';

export const SubscriptionsScreen = ({ navigation }: any) => {
    const { theme } = useAppTheme();
    const styles = useThemedStyles(createStyles);
    const { formatCurrency } = useCurrency();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<SubscriptionCategory | 'all'>('all');
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);

    const loadSubscriptions = async () => {
        try {
            const all = await getSubscriptions();
            setSubscriptions(all);
        } catch (error) {
            console.error('Error loading subscriptions:', error);
        }
    };

    useEffect(() => {
        loadSubscriptions();
        const unsubscribe = navigation.addListener('focus', () => {
            loadSubscriptions();
        });
        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        let filtered = subscriptions;



        if (selectedCategory !== 'all') {
            filtered = filtered.filter(sub => sub.category === selectedCategory);
        }

        setFilteredSubscriptions(filtered);
    }, [subscriptions, selectedCategory]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadSubscriptions();
        setRefreshing(false);
    };

    const handleDelete = (sub: Subscription) => {
        setSubToDelete(sub);
        setShowDeleteAlert(true);
    };

    const confirmDelete = async () => {
        if (subToDelete) {
            try {
                await deleteSubscription(subToDelete.id);
                await loadSubscriptions();
                setShowDeleteAlert(false);
                setSubToDelete(null);
                alertService.toastSuccess('تم حذف الاشتراك بنجاح');
            } catch (error) {
                console.error('Error deleting subscription:', error);
                alertService.error('خطأ', 'حدث خطأ أثناء حذف الاشتراك');
            }
        }
    };

    const handleEdit = (sub: Subscription) => {
        navigation.navigate('AddSubscription', { subscription: sub });
    };

    const handleAdd = () => {
        navigation.navigate('AddSubscription');
    };

    const getCategoryInfo = (category: string) => {
        return SUBSCRIPTION_CATEGORIES[category as SubscriptionCategory] || SUBSCRIPTION_CATEGORIES.other;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ar-IQ-u-nu-latn', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getDaysUntilNextBilling = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const next = new Date(dateStr);
        next.setHours(0, 0, 0, 0);
        const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const totalMonthlyCost = subscriptions
        .filter(s => s.isActive)
        .reduce((sum, s) => {
            let cost = s.amount;
            if (s.billingCycle === 'yearly') cost = s.amount / 12;
            if (s.billingCycle === 'weekly') cost = s.amount * 4.33;
            return sum + cost;
        }, 0);

    const activeSubs = subscriptions.filter(s => s.isActive).length;
    const expiringSoon = subscriptions.filter(s => {
        const days = getDaysUntilNextBilling(s.nextBillingDate);
        return s.isActive && days >= 0 && days <= 3;
    }).length;

    const renderSubscription = ({ item }: { item: Subscription }) => {
        const daysUntil = getDaysUntilNextBilling(item.nextBillingDate);
        const isDueSoon = daysUntil >= 0 && daysUntil <= 3;
        const categoryInfo = getCategoryInfo(item.category);

        return (
            <Pressable
                onPress={() => handleEdit(item)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
                <View style={styles.cardInner}>
                    <View style={[styles.statusIndicator, !item.isActive && styles.statusInactive, isDueSoon && item.isActive && styles.statusDueSoon]} />

                    <View style={styles.cardContent}>
                        <View style={styles.cardTop}>
                            <View style={[styles.iconBadge, { backgroundColor: categoryInfo.color + '15' }]}>
                                <Ionicons name={categoryInfo.icon as any} size={22} color={categoryInfo.color} />
                            </View>
                            <View style={styles.cardCenter}>
                                <Text style={styles.subName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.subCycle}>
                                    {item.billingCycle === 'monthly' ? 'شهري' : item.billingCycle === 'yearly' ? 'سنوي' : 'أسبوعي'}
                                </Text>
                            </View>
                            <View style={styles.amountWrap}>
                                <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                            </View>
                        </View>

                        <View style={styles.cardFooter}>
                            <View style={styles.dateRow}>
                                <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
                                <Text style={styles.dateText}>التجديد: {formatDate(item.nextBillingDate)}</Text>
                            </View>

                            {item.isActive && daysUntil >= 0 && daysUntil <= 7 && (
                                <View style={[styles.badge, daysUntil <= 1 ? styles.badgeUrgent : styles.badgeSoon]}>
                                    <Text style={[styles.badgeText, daysUntil <= 1 ? styles.badgeTextUrgent : styles.badgeTextSoon]}>
                                        {daysUntil === 0 ? 'اليوم' : daysUntil === 1 ? 'غداً' : `بعد ${daysUntil} أيام`}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.actions}>
                                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
                                    <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>

            <FlatList
                data={filteredSubscriptions}
                ListHeaderComponent={
                    <>


                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryContainer}>
                            <View style={[styles.summaryCard, { borderLeftColor: theme.colors.primary, borderLeftWidth: 4 }]}>
                                <Text style={styles.summaryLabel}>التكلفة الشهرية</Text>
                                <Text style={styles.summaryValue}>{formatCurrency(totalMonthlyCost)}</Text>
                                <Text style={styles.summarySub}>{activeSubs} اشتراكات نشطة</Text>
                            </View>
                            <View style={[styles.summaryCard, { borderLeftColor: theme.colors.warning, borderLeftWidth: 4 }]}>
                                <Text style={styles.summaryLabel}>تجديد قريب</Text>
                                <Text style={styles.summaryValue}>{expiringSoon}</Text>
                                <Text style={styles.summarySub}>خلال 72 ساعة</Text>
                            </View>
                        </ScrollView>

                        <View style={styles.categoryFilters}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersInner}>
                                <TouchableOpacity
                                    onPress={() => setSelectedCategory('all')}
                                    style={[styles.filterChip, selectedCategory === 'all' && styles.filterChipActive]}
                                >
                                    <Text style={[styles.filterText, selectedCategory === 'all' && styles.filterTextActive]}>الكل</Text>
                                </TouchableOpacity>
                                {Object.keys(SUBSCRIPTION_CATEGORIES).map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setSelectedCategory(cat as SubscriptionCategory)}
                                        style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                                    >
                                        <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
                                            {SUBSCRIPTION_CATEGORIES[cat as SubscriptionCategory].label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </>
                }
                renderItem={renderSubscription}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="card-outline" size={80} color={theme.colors.border} />
                        <Text style={styles.emptyTitle}>لا توجد اشتراكات</Text>
                        <Text style={styles.emptySub}>أضف اشتراكاتك الدورية مثل نيتفلكس أو الإنترنت ليتم تنبيهك قبل موعد السحب.</Text>
                        <TouchableOpacity style={styles.emptyAddBtn} onPress={handleAdd}>
                            <Text style={styles.emptyAddText}>إضافة اشتراك الآن</Text>
                        </TouchableOpacity>
                    </View>
                }
            />

            <ConfirmAlert
                visible={showDeleteAlert}
                title="حذف الاشتراك"
                message={`هل أنت متأكد من حذف اشتراك "${subToDelete?.name}"؟ سيتم إلغاء جميع التنبيهات المرتبطة به.`}
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteAlert(false)}
            />
        </View>
    );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: getPlatformFontWeight('800'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
    },
    addBtn: {
        padding: 4,
    },

    summaryContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 20,
        alignItems: 'center',

    },
    summaryCard: {
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: 16,
        padding: 16,
        minWidth: 160,
        ...getPlatformShadow('sm'),
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        marginBottom: 4,
        textAlign: isRTL ? 'right' : 'left',
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: getPlatformFontWeight('800'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    summarySub: {
        fontSize: 11,
        color: theme.colors.textMuted,
        marginTop: 4,
        textAlign: isRTL ? 'right' : 'left',
    },
    categoryFilters: {
        marginBottom: 16,
        direction: isRTL ? 'rtl' : 'ltr',
    },
    filtersInner: {
        flexDirection: isRTL ? 'row' : 'row-reverse',
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: theme.colors.surfaceCard,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    filterChipActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
    },
    filterText: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
    },
    filterTextActive: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: 20,
        marginBottom: 12,
        ...getPlatformShadow('sm'),
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    cardInner: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        overflow: 'hidden',
        borderRadius: 20,
    },
    statusIndicator: {
        width: 6,
        backgroundColor: theme.colors.success,
    },
    statusInactive: {
        backgroundColor: theme.colors.textMuted,
    },
    statusDueSoon: {
        backgroundColor: theme.colors.warning,
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    cardTop: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardCenter: {
        flex: 1,
        marginHorizontal: 12,
    },
    subName: {
        fontSize: 16,
        fontWeight: getPlatformFontWeight('700'),
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    subCycle: {
        fontSize: 12,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamily,
        textAlign: isRTL ? 'right' : 'left',
    },
    amountWrap: {
        alignItems: 'flex-end',
    },
    amount: {
        fontSize: 16,
        fontWeight: getPlatformFontWeight('800'),
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamily,
    },
    cardFooter: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border + '40',
    },
    dateRow: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateText: {
        fontSize: 12,
        color: theme.colors.textMuted,
        fontFamily: theme.typography.fontFamily,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeSoon: {
        backgroundColor: theme.colors.warning + '15',
    },
    badgeUrgent: {
        backgroundColor: theme.colors.error + '15',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    badgeTextSoon: {
        color: theme.colors.warning,
    },
    badgeTextUrgent: {
        color: theme.colors.error,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        padding: 4,
    },
    empty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.textPrimary,
        marginTop: 16,
        fontFamily: theme.typography.fontFamily,
    },
    emptySub: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
        fontFamily: theme.typography.fontFamily,
    },
    emptyAddBtn: {
        marginTop: 24,
        backgroundColor: theme.colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyAddText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 15,
        fontFamily: theme.typography.fontFamily,
    },
});
