import React, { useState, useEffect, useLayoutEffect } from 'react';
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
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
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

  useLayoutEffect(() => {
    const parent = navigation.getParent()?.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      });
    }
    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: {
            backgroundColor: theme.colors.surfaceCard,
            borderTopColor: theme.colors.primary,
            borderTopWidth: 1,
            height: 70 + (Platform.OS === 'android' ? 0 : 0),
            paddingBottom: Platform.OS === 'android' ? 8 : 20,
            paddingTop: 4,
            elevation: 8,
            shadowColor: theme.colors.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            flexDirection: 'row',
            display: 'flex',
          },
          tabBarShowLabel: true,
        });
      }
    };
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
        style={styles.billCard}
      >
        <View
          style={[
            styles.billCardContainer,
            item.isPaid && styles.billCardPaid,
            !item.isPaid && isOverdue && styles.billCardOverdue,
            !item.isPaid && isDueSoon && !isOverdue && styles.billCardDueSoon,
          ]}
        >
          {/* Top Section */}
          <View style={styles.billCardTop}>
            <Text style={styles.billAmount}>{formatCurrency(item.amount)}</Text>
            <View style={styles.billCardCenter}>
              <Text style={styles.billTitle}>{item.title}</Text>
              <Text style={styles.billCategory}>{categoryInfo.label}</Text>
            </View>
            <View style={[styles.billIconBadge, { backgroundColor: '#E5E7EB' }]}>
              <Ionicons
                name={categoryInfo.icon as any}
                size={24}
                color={theme.colors.primary}
              />
            </View>
          </View>

          {/* Separator */}
          <View style={styles.billCardSeparator} />

          {/* Bottom Section */}
          <View style={styles.billCardFooter}>
            <View style={styles.billActions}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleDelete(item);
                }}
                style={styles.actionButton}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleEdit(item);
                }}
                style={styles.actionButton}
              >
                <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            
            {!item.isPaid && daysUntilDue !== null && (
              <View style={[
                styles.daysBadge,
                isOverdue && styles.daysBadgeOverdue,
                isDueSoon && !isOverdue && styles.daysBadgeDueSoon
              ]}>
                <Ionicons 
                  name="checkmark-circle" 
                  size={14} 
                  color={isOverdue ? "#DC2626" : "#F59E0B"} 
                />
                <Text style={styles.daysText}>
                  {isOverdue ? `متأخرة ${Math.abs(daysUntilDue)} يوم` :
                   daysUntilDue === 0 ? 'مستحقة اليوم' :
                   `متبقي ${daysUntilDue} يوم`}
                </Text>
              </View>
            )}

            <View style={styles.billDateRow}>
              <Text style={styles.billDate}>
                {formatDate(item.dueDate)}
              </Text>
              <Ionicons name="calendar" size={16} color={theme.colors.textSecondary} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with Search and Filter */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="receipt" size={28} color={theme.colors.primary} />
            <Text style={styles.headerTitle}>الفواتير</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowFilterMenu(!showFilterMenu)}
            style={styles.filterButton}
          >
            <Ionicons name="filter" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        <Searchbar
          placeholder="ابحث عن فاتورة..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchbarInput}
          iconColor={theme.colors.textSecondary}
        />
      </View>

      {/* Summary Cards */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.summaryContainer}
        contentContainerStyle={styles.summaryContent}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>إجمالي الفواتير</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalBills)}</Text>
          <Text style={styles.summarySubtext}>{unpaidBills} غير مدفوعة</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>مستحقة قريباً</Text>
          <Text style={styles.summaryValue}>{dueSoonBills}</Text>
          <Text style={styles.summarySubtext}>خلال 7 أيام</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>مدفوعة</Text>
          <Text style={styles.summaryValue}>{paidBills}</Text>
          <Text style={styles.summarySubtext}>من {bills.length}</Text>
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

      {/* Bills List */}
      {filteredBills.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyText}>لا توجد فواتير</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery || selectedCategory !== 'all' 
              ? 'جرب البحث أو تغيير الفلتر'
              : 'أضف فاتورة جديدة للبدء'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBills}
          renderItem={renderBill}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

   

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  header: {
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
      ...getPlatformShadow('sm'),
  },
  headerTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  filterButton: {
    padding: 8,
  },
  searchbar: {
    backgroundColor: theme.colors.surfaceLight,
    elevation: 0,
    borderRadius: 12,
  },
  searchbarInput: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'left' : 'right',
  },
  summaryContainer: {
    maxHeight: 120,
  },
  summaryContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 12,
    padding: 16,
    minWidth: 140,
    ...getPlatformShadow('sm'),
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  summarySubtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
  },
  filterMenu: {
    backgroundColor: theme.colors.surfaceCard,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceLight,
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: getPlatformFontWeight('600'),
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  billCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  billCardContainer: {
    backgroundColor: '#FEF3C7', // Light yellow for due soon
    padding: 16,
  },
  billCardPaid: {
    backgroundColor: theme.colors.surfaceCard,
  },
  billCardOverdue: {
    backgroundColor: '#FEE2E2', // Light red for overdue
  },
  billCardDueSoon: {
    backgroundColor: '#FEF3C7', // Light yellow for due soon
  },
  billCardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  billCardCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  billTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  billCategory: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  billIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billCardSeparator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 12,
  },
  billCardFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  billActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  daysBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    gap: 6,
  },
  daysBadgeOverdue: {
    backgroundColor: '#FEE2E2',
  },
  daysBadgeDueSoon: {
    backgroundColor: '#FEF3C7',
  },
  daysText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  billDateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  billDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
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
