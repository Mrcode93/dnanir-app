import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar } from 'react-native-paper';
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
import { markBillAsPaid, markBillAsUnpaid, getBillsDueInDays } from '../services/billService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';

export const BillsScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const [bills, setBills] = useState<Bill[]>([]);
  const [filteredBills, setFilteredBills] = useState<Bill[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BillCategory | 'all'>('all');
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const loadBills = async () => {
    try {
      const allBills = await getBills();
      setBills(allBills);
    } catch (error) {
      console.error('Error loading bills:', error);
    }
  };

  useEffect(() => {
    loadBills();
    const unsubscribe = navigation.addListener('focus', () => {
      loadBills();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    let filtered = bills;

    if (searchQuery) {
      filtered = filtered.filter(bill =>
        bill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bill.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(bill => bill.category === selectedCategory);
    }

    setFilteredBills(filtered);
  }, [bills, searchQuery, selectedCategory]);

  useEffect(() => {
    if (route?.params?.action === 'add') {
      handleAdd();
      navigation.setParams({ action: undefined });
    }
  }, [route?.params]);

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
        alertService.success('نجح', 'تم حذف الفاتورة بنجاح');
      } catch (error) {
        console.error('Error deleting bill:', error);
        alertService.error('خطأ', 'حدث خطأ أثناء حذف الفاتورة');
      }
    }
  };

  const handleBillPress = (bill: Bill) => {
    navigation.navigate('Bills', {
      screen: 'BillDetails',
      params: { billId: bill.id }
    });
  };

  const handleEdit = (bill: Bill) => {
    navigation.navigate('Bills', {
      screen: 'AddBill',
      params: { bill }
    });
  };

  const handleAdd = () => {
    navigation.navigate('Bills', {
      screen: 'AddBill'
    });
  };

  const handleTogglePaid = async (bill: Bill) => {
    try {
      if (bill.isPaid) {
        await markBillAsUnpaid(bill.id);
        alertService.success('نجح', 'تم تحديث حالة الفاتورة');
      } else {
        await markBillAsPaid(bill.id);
        alertService.success('نجح', 'تم دفع الفاتورة بنجاح');
      }
      await loadBills();
    } catch (error) {
      console.error('Error toggling bill status:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء تحديث حالة الفاتورة');
    }
  };

  const getCategoryInfo = (category: string) => {
    return BILL_CATEGORIES[category as BillCategory] || BILL_CATEGORIES.other;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
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
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const totalBills = bills.filter(b => !b.isPaid).reduce((sum, b) => sum + b.amount, 0);
  const unpaidBills = bills.filter(b => !b.isPaid).length;
  const paidBills = bills.filter(b => b.isPaid).length;
  const dueSoonBills = bills.filter(b => {
    if (b.isPaid) return false;
    const days = getDaysUntilDue(b.dueDate);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const renderBill = ({ item }: { item: Bill }) => {
    const daysUntilDue = getDaysUntilDue(item.dueDate);
    const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
    const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;
    const categoryInfo = getCategoryInfo(item.category);

    return (
      <Pressable
        onPress={() => handleBillPress(item)}
        style={({ pressed }) => [styles.billCard, pressed && styles.billCardPressed]}
      >
        <View style={styles.billCardInner}>
          {/* Vertical Status Indicator Pill */}
          <View
            style={[
              styles.billStatusIndicator,
              item.isPaid && styles.billStatusPaid,
              !item.isPaid && isOverdue && styles.billStatusOverdue,
              !item.isPaid && isDueSoon && !isOverdue && styles.billStatusDueSoon,
            ]}
          />

          <View style={styles.billCardMainContent}>
            <View style={styles.billCardTop}>
              <View style={[styles.billIconBadge, { backgroundColor: categoryInfo.color + '15' }]}>
                <Ionicons name={categoryInfo.icon as any} size={24} color={categoryInfo.color} />
              </View>
              <View style={styles.billCardCenter}>
                <Text style={styles.billTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.billCategory}>{categoryInfo.label}</Text>
              </View>
              <View style={styles.billAmountWrap}>
                <Text style={styles.billAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            </View>

            <View style={styles.billCardFooter}>
              <View style={styles.billDateRow}>
                <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.billDate}>{formatDate(item.dueDate)}</Text>
              </View>

              {!item.isPaid && daysUntilDue !== null && (
                <View style={[
                  styles.daysBadge,
                  isOverdue && styles.daysBadgeOverdue,
                  isDueSoon && !isOverdue && styles.daysBadgeDueSoon,
                ]}>
                  <Ionicons name={isOverdue ? 'alert-circle' : 'time'} size={12} color={isOverdue ? '#DC2626' : '#B45309'} />
                  <Text style={[styles.daysText, isOverdue && styles.daysTextOverdue]}>
                    {isOverdue ? `متأخرة ${Math.abs(daysUntilDue)} يوم` : daysUntilDue === 0 ? 'اليوم' : `متبقي ${daysUntilDue} يوم`}
                  </Text>
                </View>
              )}

              <View style={styles.billActions}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleEdit(item); }} style={styles.actionBtn} hitSlop={10}>
                  <Ionicons name="pencil" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(item); }} style={styles.actionBtn} hitSlop={10}>
                  <Ionicons name="trash" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList
        data={filteredBills}
        ListHeaderComponent={
          <>
            {/* Search + Filter */}
            <View style={styles.searchSection}>
              <View style={styles.searchRow}>
                <Searchbar
                  placeholder="ابحث عن فاتورة..."
                  onChangeText={setSearchQuery}
                  value={searchQuery}
                  style={styles.searchbar}
                  inputStyle={styles.searchbarInput}
                  iconColor={theme.colors.textMuted}
                  placeholderTextColor={theme.colors.textMuted}
                />
                <TouchableOpacity
                  onPress={() => setShowFilterMenu(!showFilterMenu)}
                  style={[styles.filterButton, showFilterMenu && styles.filterButtonActive]}
                >
                  <Ionicons name="options-outline" size={22} color={showFilterMenu ? theme.colors.primary : theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Summary Cards - modern compact */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.summaryScroll}
              contentContainerStyle={styles.summaryContent}
            >
              <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
                <View style={styles.summaryCardIconWrap}>
                  <Ionicons name="receipt-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={styles.summaryLabel} numberOfLines={1}>إجمالي الفواتير</Text>
                <View style={styles.summaryValueWrap}>
                  <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                    {formatCurrency(totalBills)}
                  </Text>
                </View>
                <Text style={styles.summarySubtext} numberOfLines={1}>{unpaidBills} غير مدفوعة</Text>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryCardIconWrap, styles.summaryCardIconAmber]}>
                  <Ionicons name="time-outline" size={18} color="#D97706" />
                </View>
                <Text style={styles.summaryLabel} numberOfLines={1}>مستحقة قريباً</Text>
                <View style={styles.summaryValueWrap}>
                  <Text style={styles.summaryValue} numberOfLines={1}>{dueSoonBills}</Text>
                </View>
                <Text style={styles.summarySubtext} numberOfLines={1}>خلال 7 أيام</Text>
              </View>
              <View style={styles.summaryCard}>
                <View style={[styles.summaryCardIconWrap, styles.summaryCardIconGreen]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                </View>
                <Text style={styles.summaryLabel} numberOfLines={1}>مدفوعة</Text>
                <View style={styles.summaryValueWrap}>
                  <Text style={styles.summaryValue} numberOfLines={1}>{paidBills}</Text>
                </View>
                <Text style={styles.summarySubtext} numberOfLines={1}>من {bills.length}</Text>
              </View>
            </ScrollView>

            {/* Filter Menu */}
            {showFilterMenu && (
              <View style={styles.filterMenu}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCategory('all');
                      setShowFilterMenu(false);
                    }}
                    style={[
                      styles.filterChip,
                      selectedCategory === 'all' && styles.filterChipActive
                    ]}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedCategory === 'all' && styles.filterChipTextActive
                    ]}>
                      الكل
                    </Text>
                  </TouchableOpacity>
                  {Object.keys(BILL_CATEGORIES).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => {
                        setSelectedCategory(cat as BillCategory);
                        setShowFilterMenu(false);
                      }}
                      style={[
                        styles.filterChip,
                        selectedCategory === cat && styles.filterChipActive
                      ]}
                    >
                      <Text style={[
                        styles.filterChipText,
                        selectedCategory === cat && styles.filterChipTextActive
                      ]}>
                        {BILL_CATEGORIES[cat as BillCategory].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        }
        renderItem={renderBill}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>لا توجد فواتير</Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || selectedCategory !== 'all'
                ? 'جرب البحث أو تغيير الفلتر'
                : 'أضف فاتورة جديدة للبدء'}
            </Text>
          </View>
        }
      />



      {/* Modals */}
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
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  searchSection: {
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  searchRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchbar: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    elevation: 0,
    shadowOpacity: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchbarInput: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary + '12',
    borderColor: theme.colors.primary + '40',
  },
  summaryScroll: {
    // Increased height to prevent content cropping
    maxHeight: 140,
  },
  summaryContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingEnd: 24,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20, // More modern large radius
    padding: 16,
    minWidth: 145,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8 }
      : { elevation: 2 }),
  },
  summaryCardPrimary: {
    minWidth: 190,
    borderLeftWidth: isRTL ? 0 : 5,
    borderLeftColor: theme.colors.primary,
    borderRightWidth: isRTL ? 5 : 0,
    borderRightColor: theme.colors.primary,
    paddingLeft: isRTL ? 16 : 20,
    paddingRight: isRTL ? 20 : 16,
  },
  summaryValueWrap: {
    minHeight: 28, // More height for value
    width: '100%',
    justifyContent: 'center',
    marginVertical: 2,
  },
  summaryCardIconWrap: {
    width: 32, // Slightly larger icon container
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryCardIconAmber: {
    backgroundColor: '#FEF3C7',
  },
  summaryCardIconGreen: {
    backgroundColor: '#D1FAE5',
  },
  summaryLabel: {
    fontSize: 12, // Slightly larger label
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  summaryValue: {
    fontSize: 17, // Larger value text
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  summarySubtext: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
    textAlign: 'left',
  },
  filterMenu: {
    backgroundColor: theme.colors.surfaceCard,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: getPlatformFontWeight('600'),
  },
  listContent: {
    padding: 16,
    paddingBottom: 110, // More bottom padding for FAB
  },
  billCard: {
    marginBottom: 16, // More space between cards
    borderRadius: 24, // Softer, more modern corners
    direction: 'rtl' as const,
    backgroundColor: theme.colors.surfaceCard,
    // Premium shadow
    ...(Platform.OS === 'ios'
      ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10
      }
      : { elevation: 3 }),
  },
  billCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  billCardInner: {
    padding: 16,
    borderRadius: 24,
    overflow: 'hidden',
    flexDirection: 'row-reverse', // Ensure side pill is on the correct side
    minHeight: 110,
  },
  // Vertical status indicator pill
  billStatusIndicator: {
    width: 5,
    borderRadius: 4,
    marginVertical: 4,
    backgroundColor: theme.colors.border,
  },
  billStatusPaid: {
    backgroundColor: '#10B981',
  },
  billStatusOverdue: {
    backgroundColor: '#EF4444',
  },
  billStatusDueSoon: {
    backgroundColor: '#F59E0B',
  },
  billCardMainContent: {
    flex: 1,
    paddingHorizontal: 12,
  },
  billCardTop: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  billIconBadge: {
    width: 48, // Slightly larger
    height: 48,
    borderRadius: 15, // Smooth rounded corners
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
  },
  billCardCenter: {
    flex: 1,
    marginHorizontal: 12,
    justifyContent: 'center',
  },
  billTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
    textAlign: 'left',
  },
  billCategory: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily,
  },
  billAmountWrap: {
    alignItems: 'flex-end',
  },
  billAmount: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('900'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  billCardFooter: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '40', // Very subtle divider
  },
  billDateRow: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  billDate: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  daysBadge: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  daysBadgeOverdue: {
    backgroundColor: '#FEF2F2',
  },
  daysBadgeDueSoon: {
    backgroundColor: '#FFFBEB',
  },
  daysText: {
    fontSize: 11,
    color: '#B45309',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  daysTextOverdue: {
    color: '#DC2626',
  },
  billActions: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    [isRTL ? 'left' : 'right']: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  addButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
