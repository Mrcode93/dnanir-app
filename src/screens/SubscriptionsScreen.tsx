import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getSubscriptions, deleteSubscription, Subscription, getCustomCategories } from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { SUBSCRIPTION_CATEGORIES } from '../types';
import { SubscriptionDetailsModal } from '../components/SubscriptionDetailsModal';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { tl, useLocalization } from "../localization";
import { convertCurrency } from '../services/currencyService';

/* --- Sub Component for Subscription Item --- */
const SubscriptionItem = ({ item, info, currencyCode, formatCurrency, onEdit, onDelete, onPress, theme, styles }: any) => {
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const itemCurrency = item.currency || 'IQD';

  useEffect(() => {
    let cancelled = false;
    const convert = async () => {
      if (itemCurrency !== currencyCode) {
        try {
          const converted = await convertCurrency(item.amount, itemCurrency, currencyCode);
          if (!cancelled) setConvertedAmount(converted);
        } catch (e) {
          if (!cancelled) setConvertedAmount(null);
        }
      } else {
        if (!cancelled) setConvertedAmount(null);
      }
    };
    convert();
    return () => { cancelled = true; };
  }, [item.amount, itemCurrency, currencyCode]);

  const dueDate = new Date(item.nextPaymentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const nextPaymentDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isDueSoon = nextPaymentDays >= 0 && nextPaymentDays <= 7;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-IQ-u-nu-latn' : 'en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.itemWrapper}>
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.7} 
        style={styles.billCard}
      >
        <View style={[styles.billStatusBar, { backgroundColor: item.isActive ? info.color : theme.colors.border }]} />
        
        <View style={styles.billCardContent}>
          <View style={styles.billCardTop}>
            <View style={[styles.billIconBadge, { backgroundColor: info.color + '15' }]}>
              {info.library === 'Ionicons' ? (
                <Ionicons name={info.icon as any} size={24} color={info.color} />
              ) : (
                <MaterialCommunityIcons name={info.icon as any} size={24} color={info.color} />
              )}
            </View>
            <View style={styles.billCardCenter}>
              <Text style={styles.billTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.billCategory}>{item.category === 'other' ? tl("أخرى") : info.label}</Text>
            </View>
            <View style={styles.amountContainer}>
              <Text style={styles.billAmount}>{formatCurrency(item.amount, { currencyCode: itemCurrency })}</Text>
              {convertedAmount !== null && (
                <Text style={styles.convertedAmount}>
                  ≈ {formatCurrency(convertedAmount)}
                </Text>
              )}
            </View>
            <View style={styles.paidBadge}>
               <Text style={[styles.paidBadgeText, { color: theme.colors.textMuted }]}>
                 {item.billingCycle === 'monthly' ? tl("شهري") : item.billingCycle === 'yearly' ? tl("سنوي") : tl("أسبوعي")}
               </Text>
            </View>
          </View>

          <View style={styles.billCardFooter}>
            <View style={styles.billDateRow}>
              <Ionicons name="time-outline" size={13} color={theme.colors.textMuted} />
              <Text style={styles.billDate}>{tl("الدفع القادم:")} {formatDate(item.nextPaymentDate)}</Text>
            </View>

            {item.isActive && isDueSoon && (
              <View style={[styles.daysBadge, { backgroundColor: theme.colors.warning + '15' }]}>
                <Text style={[styles.daysText, { color: theme.colors.warning }]}>
                  {nextPaymentDays === 0 ? tl("اليوم") : tl("خلال {{}} يوم", [nextPaymentDays])}
                </Text>
              </View>
            )}

            <View style={styles.billActions}>
              <TouchableOpacity onPress={e => {
                e.stopPropagation();
                onEdit();
              }} style={styles.actionBtn} hitSlop={8}>
                <Ionicons name="pencil-outline" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={e => {
                e.stopPropagation();
                onDelete();
              }} style={styles.actionBtn} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export const SubscriptionsScreen = ({
  navigation,
  route
}: any) => {
  const {
    language
  } = useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency,
    currencyCode
  } = useCurrency();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, title: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allSubs, custom] = await Promise.all([
        getSubscriptions(),
        getCustomCategories('subscription')
      ]);
      setSubscriptions(allSubs);
      setCustomCategories(custom);
    } catch (error) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, loadData]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: tl("الاشتراكات"),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AddSubscription')}
          style={{
            marginRight: isRTL ? 0 : 16,
            marginLeft: isRTL ? 16 : 0,
            padding: 8,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
          }}
        >
          <Ionicons name="add-circle" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isRTL]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = (item: Subscription) => {
    setItemToDelete({
      id: item.id,
      title: item.name
    });
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        await deleteSubscription(itemToDelete.id);
        alertService.toastSuccess(tl("تم حذف الاشتراك بنجاح"));
        await loadData();
        setShowDeleteAlert(false);
        setItemToDelete(null);
      } catch (error) {
        alertService.error(tl("خطأ"), tl("حدث خطأ أثناء الحذف"));
      }
    }
  };

  const handleEditSubscription = (sub: Subscription) => {
    navigation.navigate('AddSubscription', {
      subscription: sub
    });
  };

  const getSubCategoryInfo = (cat: string) => {
    const predefined = SUBSCRIPTION_CATEGORIES[cat as SubscriptionCategory];
    if (predefined) return predefined;
    const custom = customCategories.find(c => c.name === cat);
    if (custom) return { label: custom.name, icon: custom.icon, color: custom.color, library: 'Ionicons' as const };
    return SUBSCRIPTION_CATEGORIES.other;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const summary = useMemo(() => {
    let total = 0;
    let active = 0;
    let inactive = 0;
    let dueSoon = 0;

    for (const s of subscriptions) {
      if (s.isActive) {
        total += s.amount;
        active++;
        const days = getDaysUntilDue(s.nextPaymentDate);
        if (days >= 0 && days <= 7) dueSoon++;
      } else {
        inactive++;
      }
    }

    return {
      monthlyCost: total,
      activeCount: active,
      inactiveCount: inactive,
      dueSoonCount: dueSoon
    };
  }, [subscriptions]);

  const renderSubscriptionItem = useCallback(({ item }: { item: Subscription }) => (
    <SubscriptionItem
      item={item}
      info={getSubCategoryInfo(item.category)}
      currencyCode={currencyCode}
      formatCurrency={formatCurrency}
      onEdit={() => {
        setSelectedSub(null);
        setShowDetailsModal(false);
        handleEditSubscription(item);
      }}
      onDelete={() => handleDelete(item)}
      onPress={() => {
        setSelectedSub(item);
        setShowDetailsModal(true);
      }}
      theme={theme}
      styles={styles}
    />
  ), [getSubCategoryInfo, currencyCode, formatCurrency, theme, styles, handleEditSubscription, handleDelete]);

  const renderSummaryCard = () => (
    <View style={styles.summaryContainer}>
      <LinearGradient
        colors={theme.gradients.primary as any}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.summaryContent}>
          <View style={styles.summaryIconContainer}>
            <Ionicons name="card" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.summaryTextContainer}>
            <Text style={styles.summaryLabel}>{tl("التكلفة الشهرية للخدمات")}</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(summary.monthlyCost)}</Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <View style={styles.summaryStatItem}>
            <Ionicons name="flash-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryStatText}>{summary.activeCount} {tl("نشط")}</Text>
          </View>
          <View style={styles.summaryStatDivider} />
          <View style={styles.summaryStatItem}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryStatText}>{summary.dueSoonCount} {tl("قريباً")}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlashList
        data={subscriptions}
        estimatedItemSize={120}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderSummaryCard}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={renderSubscriptionItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="card-outline" size={64} color={theme.colors.primary + '40'} />
              </View>
              <Text style={styles.emptyText}>{tl("لا توجد اشتراكات مسجلة")}</Text>
              <Text style={styles.emptySubtext}>{tl("أضف اشتراكاتك الرقمية لتتبع مصاريفك الشهرية")}</Text>
            </View>
          ) : null
        }
      />

      {showDeleteAlert && itemToDelete && (
        <ConfirmAlert
          visible={showDeleteAlert}
          title={tl("حذف الاشتراك")}
          message={tl("هل أنت متأكد من حذف اشتراك '{{}}'؟", [itemToDelete.title])}
          confirmText={tl("حذف")}
          cancelText={tl("إلغاء")}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteAlert(false)}
          type="danger"
        />
      )}

      {/* Subscription Details Modal */}
      <SubscriptionDetailsModal
        visible={showDetailsModal}
        subscription={selectedSub}
        onClose={() => setShowDetailsModal(false)}
        onEdit={() => {
          if (selectedSub) {
            setShowDetailsModal(false);
            handleEditSubscription(selectedSub);
          }
        }}
        onDelete={() => {
          if (selectedSub) {
            handleDelete(selectedSub);
          }
        }}
        onStatusChange={() => {
          loadData();
        }}
        customCategories={customCategories}
      />
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  summaryContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
    marginTop: 20
  },
  summaryCard: {
    borderRadius: 20,
    padding: 16,
    ...getPlatformShadow('md')
  },
  summaryContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center'
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 16 : 0,
    marginRight: isRTL ? 0 : 16
  },
  summaryTextContainer: {
    flex: 1
  },
  summaryLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left'
  },
  summaryAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 24,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    textAlign: isRTL ? 'right' : 'left'
  },
  summaryFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 12,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8
  },
  summaryStatItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center'
  },
  summaryStatText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: getPlatformFontWeight('600')
  },
  summaryStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)'
  },
  listContent: {
    paddingBottom: 100
  },
  itemWrapper: {
    paddingHorizontal: 20
  },
  billCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    overflow: 'hidden',
    ...getPlatformShadow('sm')
  },
  billStatusBar: {
    width: 4,
    borderRadius: 4,
    margin: 12,
    backgroundColor: theme.colors.border
  },
  billCardContent: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: isRTL ? 0 : 14,
    paddingLeft: isRTL ? 14 : 0
  },
  billCardTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  billIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  billCardCenter: {
    flex: 1,
    marginHorizontal: 10
  },
  billTitle: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 3,
    textAlign: isRTL ? 'right' : 'left'
  },
  billCategory: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  billAmountWrap: {
    alignItems: isRTL ? 'flex-start' : 'flex-end',
    justifyContent: 'center',
  },
  amountContainer: {
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  billAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  convertedAmount: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  paidBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3
  },
  paidBadgeText: {
    fontSize: 10,
    color: theme.colors.success,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600')
  },
  billCardFooter: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '40',
    paddingTop: 10
  },
  billDateRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1
  },
  billDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600')
  },
  daysBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginHorizontal: 6
  },
  daysText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700')
  },
  billActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  emptySubtext: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: '70%'
  }
});
