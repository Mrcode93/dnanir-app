import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import {
  getBills,
  deleteBill,
  Bill,
} from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { BILL_CATEGORIES, BillCategory } from '../types';
import { markBillAsPaid, markBillAsUnpaid } from '../services/billService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';

export const BillsScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<BillCategory | 'all'>('all');
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(false);

  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      const allBills = await getBills();
      setBills(allBills);
    } catch (error) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills();
    const unsubscribe = navigation.addListener('focus', () => {
      loadBills();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route?.params?.action === 'add') {
      navigation.navigate('AddBill');
      navigation.setParams({ action: undefined });
    }
  }, [route?.params]);

  useEffect(() => {
    let filtered = bills;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(bill => bill.category === selectedCategory);
    }
    setFilteredBills(filtered);
  }, [bills, selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBills();
    setRefreshing(false);
  };

  const handleDelete = (bill: Bill) => {
    setBillToDelete(bill);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (billToDelete) {
      try {
        await deleteBill(billToDelete.id);
        await loadBills();
        setShowDeleteAlert(false);
        setBillToDelete(null);
        alertService.toastSuccess('تم حذف الفاتورة بنجاح');
      } catch (error) {
        alertService.error('خطأ', 'حدث خطأ أثناء حذف الفاتورة');
      }
    }
  };

  const handleBillPress = (bill: Bill) => {
    navigation.navigate('BillDetails', { billId: bill.id });
  };

  const handleEdit = (bill: Bill) => {
    navigation.navigate('AddBill', { bill });
  };


  const handleTogglePaid = async (bill: Bill) => {
    try {
      if (bill.isPaid) {
        await markBillAsUnpaid(bill.id);
        alertService.toastSuccess('تم تحديث حالة الفاتورة');
      } else {
        await markBillAsPaid(bill.id);
        alertService.toastSuccess('تم دفع الفاتورة بنجاح');
      }
      await loadBills();
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء تحديث حالة الفاتورة');
    }
  };

  const getCategoryInfo = (category: string) => {
    return BILL_CATEGORIES[category as BillCategory] || BILL_CATEGORIES.other;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-IQ-u-nu-latn', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const { totalBills, unpaidBills, paidBills, dueSoonBills } = useMemo(() => {
    let total = 0;
    let unpaid = 0;
    let paid = 0;
    let dueSoon = 0;
    for (const b of bills) {
      if (b.isPaid) {
        paid++;
      } else {
        total += b.amount;
        unpaid++;
        const days = getDaysUntilDue(b.dueDate);
        if (days >= 0 && days <= 7) dueSoon++;
      }
    }
    return { totalBills: total, unpaidBills: unpaid, paidBills: paid, dueSoonBills: dueSoon };
  }, [bills]);

  const renderSummaryCard = () => (
    <View style={styles.summaryContainer}>
      <LinearGradient
        colors={theme.gradients.error as any}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.summaryContent}>
          <View style={styles.summaryIconContainer}>
            <Ionicons name="receipt" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.summaryTextContainer}>
            <Text style={styles.summaryLabel}>إجمالي الفواتير غير المدفوعة</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalBills)}</Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <View style={styles.summaryStatItem}>
            <Ionicons name="close-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryStatText}>{unpaidBills} غير مدفوعة</Text>
          </View>
          <View style={styles.summaryStatDivider} />
          <View style={styles.summaryStatItem}>
            <Ionicons name="checkmark-circle-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryStatText}>{paidBills} مدفوعة</Text>
          </View>
          <View style={styles.summaryStatDivider} />
          <View style={styles.summaryStatItem}>
            <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryStatText}>{dueSoonBills} قريباً</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderBillItem = useCallback(({ item }: { item: Bill }) => {
    const daysUntilDue = getDaysUntilDue(item.dueDate);
    const isOverdue = daysUntilDue < 0;
    const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;
    const categoryInfo = getCategoryInfo(item.category);

    return (
      <View style={styles.itemWrapper}>
        <TouchableOpacity
          onPress={() => handleBillPress(item)}
          activeOpacity={0.7}
          style={styles.billCard}
        >
          {/* Status side bar */}
          <View style={[
            styles.billStatusBar,
            item.isPaid && { backgroundColor: theme.colors.success },
            !item.isPaid && isOverdue && { backgroundColor: theme.colors.error },
            !item.isPaid && isDueSoon && !isOverdue && { backgroundColor: theme.colors.warning },
            !item.isPaid && !isOverdue && !isDueSoon && { backgroundColor: theme.colors.border },
          ]} />

          <View style={styles.billCardContent}>
            {/* Top row */}
            <View style={styles.billCardTop}>
              <View style={[styles.billIconBadge, { backgroundColor: categoryInfo.color + '15' }]}>
                <Ionicons name={categoryInfo.icon as any} size={22} color={categoryInfo.color} />
              </View>
              <View style={styles.billCardCenter}>
                <Text style={styles.billTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.billCategory}>{categoryInfo.label}</Text>
              </View>
              <View style={styles.billAmountWrap}>
                <Text style={[styles.billAmount, item.isPaid && styles.billAmountPaid]}>
                  {formatCurrency(item.amount)}
                </Text>
                {item.isPaid && (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.colors.success} />
                    <Text style={styles.paidBadgeText}>مدفوعة</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Bottom row */}
            <View style={styles.billCardFooter}>
              <View style={styles.billDateRow}>
                <Ionicons name="calendar-outline" size={13} color={theme.colors.textMuted} />
                <Text style={styles.billDate}>{formatDate(item.dueDate)}</Text>
              </View>

              {!item.isPaid && (
                <View style={[
                  styles.daysBadge,
                  isOverdue && { backgroundColor: theme.colors.error + '15' },
                  isDueSoon && !isOverdue && { backgroundColor: theme.colors.warning + '15' },
                ]}>
                  <Text style={[
                    styles.daysText,
                    isOverdue && { color: theme.colors.error },
                    isDueSoon && !isOverdue && { color: theme.colors.warning },
                  ]}>
                    {isOverdue
                      ? `متأخرة ${Math.abs(daysUntilDue)} يوم`
                      : daysUntilDue === 0 ? 'اليوم'
                      : `${daysUntilDue} يوم`}
                  </Text>
                </View>
              )}

              <View style={styles.billActions}>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); handleTogglePaid(item); }}
                  style={[styles.actionBtn, item.isPaid && styles.actionBtnActive]}
                  hitSlop={8}
                >
                  <Ionicons
                    name={item.isPaid ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={item.isPaid ? theme.colors.success : theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); handleEdit(item); }}
                  style={styles.actionBtn}
                  hitSlop={8}
                >
                  <Ionicons name="pencil-outline" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); handleDelete(item); }}
                  style={styles.actionBtn}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [theme, styles, formatCurrency]);

  return (
    <View style={styles.container}>
      <FlashList
        data={filteredBills}
        // @ts-ignore
        estimatedItemSize={100}
        ListHeaderComponent={
          <>
            {/* <View style={styles.header}>
              <View style={styles.categoriesRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesContent}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedCategory('all')}
                    style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.categoryChipTextActive]}>
                      الكل
                    </Text>
                  </TouchableOpacity>
                  {(Object.keys(BILL_CATEGORIES) as BillCategory[]).map((cat) => {
                    const info = BILL_CATEGORIES[cat];
                    const isSelected = selectedCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        style={[
                          styles.categoryChip,
                          isSelected && { backgroundColor: info.color + '20', borderColor: info.color, borderWidth: 1 },
                        ]}
                      >
                        <Ionicons
                          name={info.icon as any}
                          size={14}
                          color={isSelected ? info.color : theme.colors.textSecondary}
                          style={{ marginHorizontal: 2 }}
                        />
                        <Text style={[
                          styles.categoryChipText,
                          isSelected && { color: info.color, fontWeight: getPlatformFontWeight('700') },
                        ]}>
                          {info.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View> */}
            {renderSummaryCard()}
          </>
        }
        renderItem={renderBillItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="receipt-outline" size={64} color={theme.colors.primary + '40'} />
              </View>
              <Text style={styles.emptyText}>لا توجد فواتير</Text>
              <Text style={styles.emptySubtext}>
                {selectedCategory !== 'all' ? 'لا توجد نتائج لهذه الفئة' : 'أضف فاتورة جديدة للبدء'}
              </Text>
            </View>
          ) : null
        }
      />




      <ConfirmAlert
        visible={showDeleteAlert}
        title="حذف الفاتورة"
        message={`هل أنت متأكد من حذف الفاتورة "${billToDelete?.title}"؟`}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteAlert(false);
          setBillToDelete(null);
        }}
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
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...getPlatformShadow('xs'),
    zIndex: 10,
  },
  categoriesRow: {
    marginTop: 4,

  },
  categoriesContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  categoryChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 32,
    gap: 4,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('600'),
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  summaryContainer: {
    marginBottom: 20,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 16,
    ...getPlatformShadow('md'),
  },
  summaryContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 16 : 0,
    marginRight: isRTL ? 0 : 16,
  },
  summaryTextContainer: {
    flex: 1,
  },
  summaryLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  summaryAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 24,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    textAlign: isRTL ? 'right' : 'left',
  },
  summaryFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 12,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryStatItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  summaryStatText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: getPlatformFontWeight('600'),
  },
  summaryStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  listContent: {
    paddingBottom: 100,
  },
  itemWrapper: {
    paddingHorizontal: 20,
  },
  billCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  billStatusBar: {
    width: 4,
    borderRadius: 4,
    margin: 12,
    backgroundColor: theme.colors.border,
  },
  billCardContent: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: isRTL ? 0 : 14,
    paddingLeft: isRTL ? 14 : 0,
  },
  billCardTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  billIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billCardCenter: {
    flex: 1,
    marginHorizontal: 10,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 3,
    textAlign: isRTL ? 'right' : 'left',
  },
  billCategory: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  billAmountWrap: {
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  billAmount: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  billAmountPaid: {
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  paidBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  paidBadgeText: {
    fontSize: 10,
    color: theme.colors.success,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  billCardFooter: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '40',
    paddingTop: 10,
  },
  billDateRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  billDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  daysBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  daysText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  billActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
  },
  actionBtnActive: {
    backgroundColor: theme.colors.success + '15',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: '70%',
  },
  addModalOptions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 16,
  },
  addModalOption: {
    flex: 1,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    ...getPlatformShadow('sm'),
  },
  addModalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  addModalOptionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  addModalOptionSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
