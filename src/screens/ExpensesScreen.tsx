import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TransactionItem } from '../components/TransactionItem';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import {
  getExpensesPaginated,
  getExpensesTotalAmount,
  getExpensesCount,
  getAvailableExpenseMonths,
  deleteExpense,
  getCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
  updateCustomCategory,
  CustomCategory
} from '../database/database';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';
import { MonthFilter } from '../components/MonthFilter';
import { getMonthRange, formatDateLocal } from '../utils/date';
import { SmartAddModal } from '../components/SmartAddModal';
import { usePrivacy } from '../context/PrivacyContext';

const ITEMS_PER_PAGE = 10;

export const ExpensesScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();

  // Data State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // UI State
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter State
  const [filterType, setFilterType] = useState<'month' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');

  // Month State
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSmartAdd, setShowSmartAdd] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  // Animations
  const addModalAnim = useRef(new Animated.Value(0)).current;

  // Animate Modal
  useEffect(() => {
    if (showAddModal) {
      Animated.spring(addModalAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
      }).start();
    } else {
      Animated.timing(addModalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showAddModal]);

  const fetchExpenses = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;

      // Calculate date range
      let startDateStr: string | undefined;
      let endDateStr: string | undefined;

      if (filterType === 'day') {
        const dateStr = formatDateLocal(selectedDate);
        startDateStr = dateStr;
        endDateStr = dateStr;
      } else if (selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0)) {
        const { firstDay, lastDay } = getMonthRange(selectedMonth.year, selectedMonth.month);
        startDateStr = firstDay;
        endDateStr = lastDay;
      }

      const filterOptions = {
        startDate: startDateStr,
        endDate: endDateStr,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
      };

      // Fetch Data
      const [newExpenses, total, count] = await Promise.all([
        getExpensesPaginated({
          ...filterOptions,
          limit: ITEMS_PER_PAGE,
          offset: currentOffset,
        }),
        reset ? getExpensesTotalAmount(filterOptions) : Promise.resolve(null),
        reset ? getExpensesCount(filterOptions) : Promise.resolve(null)
      ]);

      if (reset) {
        if (total !== null) setTotalAmount(total);
        if (count !== null) setTotalCount(count);
        setExpenses(newExpenses);
        setOffset(ITEMS_PER_PAGE);
      } else {
        setExpenses(prev => [...prev, ...newExpenses]);
        setOffset(prev => prev + ITEMS_PER_PAGE);
      }

      setHasMore(newExpenses.length >= ITEMS_PER_PAGE);

      // Load available months only on initial load
      if (reset && filterType === 'month') {
        const months = await getAvailableExpenseMonths();
        setAvailableMonths(months);
      }

    } catch (error) {
      console.error('Error loading expenses:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [selectedMonth, selectedCategory, offset, filterType, selectedDate]);

  // Initial Load & Filter Changes
  useEffect(() => {
    fetchExpenses(true);
  }, [selectedMonth, selectedCategory, filterType, selectedDate]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchExpenses(true);
      loadCustomCategories();
    });
    return unsubscribe;
  }, [navigation, fetchExpenses]);

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      // Ignore
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchExpenses(true);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchExpenses(false);
    }
  };

  const handleAddOption = (option: 'manual' | 'voice') => {
    setShowAddModal(false);
    if (option === 'manual') {
      navigation.navigate('AddExpense');
    } else {
      setShowSmartAdd(true);
    }
  };

  const handleCategorySelect = (category: ExpenseCategory | 'all') => {
    if (selectedCategory === category && category !== 'all') {
      setSelectedCategory('all');
    } else {
      setSelectedCategory(category);
    }
  };

  const onDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
    }
  };

  const renderExpenseItem = useCallback(({ item }: { item: Expense }) => (
    <View style={styles.itemWrapper}>
      <TransactionItem
        item={item}
        type="expense"
        formatCurrency={formatCurrency}
        customCategories={customCategories}
        onEdit={() => navigation.navigate('AddExpense', { expense: item })}
        onDelete={async () => {
          try {
            await deleteExpense(item.id);
            alertService.success('نجح', 'تم حذف المصروف بنجاح');
            fetchExpenses(true);
          } catch (error) {
            alertService.error('خطأ', 'حدث خطأ أثناء حذف المصروف');
          }
        }}
      />
    </View>
  ), [customCategories, formatCurrency, navigation, fetchExpenses]);

  const renderListHeader = () => (
    <View style={styles.summaryContainer}>
      <LinearGradient
        colors={['#EF4444', '#DC2626']}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.summaryContent}>
          <View style={styles.summaryIconContainer}>
            <Ionicons name="trending-down" size={24} color="#FFF" />
          </View>
          <View style={styles.summaryTextContainer}>
            <Text style={styles.summaryLabel}>إجمالي المصاريف</Text>
            <Text style={styles.summaryAmount}>
              {isPrivacyEnabled ? '****' : formatCurrency(totalAmount)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryCount}>
            {isPrivacyEnabled
              ? `*** مصروف ${filterType === 'day' ? 'لهذا اليوم' : 'لهذا الشهر'}`
              : `${totalCount} مصروف ${filterType === 'day' ? 'لهذا اليوم' : 'لهذا الشهر'}`}
          </Text>
          <Text style={styles.summaryLoadedCount}>
            {isPrivacyEnabled ? '(*** معروض)' : `(${expenses.length} معروض)`}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  const renderFooter = () => {
    if (!hasMore && expenses.length > 0) return (
      <View style={styles.endOfListContainer}>
        <Text style={styles.endOfListText}>نهاية القائمة</Text>
      </View>
    );
    if (!hasMore) return <View style={{ height: 20 }} />;

    return (
      <View style={styles.footerContainer}>
        <TouchableOpacity
          onPress={handleLoadMore}
          style={styles.loadMoreButton}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={styles.loadMoreText}>عرض المزيد</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList
        data={expenses}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              {/* Filter Type Toggle & Date/Month Selector */}
              <View style={styles.dateFilterRow}>
                <View style={styles.filterTypeToggle}>
                  <TouchableOpacity
                    onPress={() => setFilterType('month')}
                    style={[styles.toggleBtn, filterType === 'month' && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleText, filterType === 'month' && styles.toggleTextActive]}>شهري</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setFilterType('day')}
                    style={[styles.toggleBtn, filterType === 'day' && styles.toggleBtnActive]}
                  >
                    <Text style={[styles.toggleText, filterType === 'day' && styles.toggleTextActive]}>يومي</Text>
                  </TouchableOpacity>
                </View>

                {filterType === 'month' ? (
                  <View style={styles.monthFilterWrapper}>
                    <MonthFilter
                      selectedMonth={selectedMonth}
                      onMonthChange={(year, month) => setSelectedMonth({ year, month })}
                      showAllOption={true}
                      availableMonths={availableMonths}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.daySelector}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.daySelectorText}>{formatDateLocal(selectedDate)}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {showDatePicker && (
                Platform.OS === 'ios' ? (
                  <Modal
                    visible={showDatePicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                  >
                    <View style={styles.modalOverlay}>
                      <View style={styles.pickerModalContent}>
                        <View style={styles.pickerHeader}>
                          <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                            <Text style={styles.pickerDoneText}>تم</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={selectedDate}
                          mode="date"
                          display="spinner"
                          onChange={onDateChange}
                          textColor="#000000"
                        />
                      </View>
                    </View>
                  </Modal>
                ) : (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                  />
                )
              )}

              <View style={styles.categoriesRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesContent}
                >
                  <TouchableOpacity
                    onPress={() => handleCategorySelect('all')}
                    style={[
                      styles.categoryChip,
                      selectedCategory === 'all' && styles.categoryChipActive
                    ]}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      selectedCategory === 'all' && styles.categoryChipTextActive
                    ]}>الكل</Text>
                  </TouchableOpacity>

                  {customCategories.map((category) => {
                    const isSelected = selectedCategory === category.name;
                    return (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => handleCategorySelect(category.name as ExpenseCategory)}
                        style={[
                          styles.categoryChip,
                          isSelected && { backgroundColor: category.color + '20', borderColor: category.color, borderWidth: 1 }
                        ]}
                      >
                        <Ionicons
                          name={category.icon as any}
                          size={16}
                          color={isSelected ? category.color : theme.colors.textSecondary}
                          style={styles.categoryChipIcon}
                        />
                        <Text style={[
                          styles.categoryChipText,
                          isSelected && { color: category.color, fontWeight: '700' }
                        ]}>{category.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
            {renderListHeader()}
          </>
        }
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="receipt-outline" size={64} color={theme.colors.primary + '40'} />
              </View>
              <Text style={styles.emptyText}>لا توجد مصاريف مسجلة</Text>
              <Text style={styles.emptySubtext}>تأكد من الفلاتر أو أضف مصروفاً جديداً</Text>
            </View>
          ) : null
        }
        ListFooterComponent={renderFooter}
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
          style={styles.fabButton}
        >
          <LinearGradient
            colors={theme.gradients.error as any}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="add" size={32} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Add Options Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable
          style={styles.addModalOverlay}
          onPress={() => setShowAddModal(false)}
        >
          <Animated.View
            style={[
              styles.addModalContainer,
              {
                transform: [{
                  translateY: addModalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.addModalHandle} />
            <Text style={styles.addModalTitle}>إضافة مصروف جديد</Text>

            <View style={styles.addModalOptions}>
              <TouchableOpacity
                style={styles.addModalOption}
                onPress={() => handleAddOption('manual')}
                activeOpacity={0.7}
              >
                <View style={[styles.addModalIconContainer, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Ionicons name="create-outline" size={28} color={theme.colors.primary} />
                </View>
                <Text style={styles.addModalOptionTitle}>إدخال يدوي</Text>
                <Text style={styles.addModalOptionSubtitle}>أدخل التفاصيل بنفسك</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addModalOption}
                onPress={() => handleAddOption('voice')}
                activeOpacity={0.7}
              >
                <View style={[styles.addModalIconContainer, { backgroundColor: '#10B981' + '15' }]}>
                  <Ionicons name="mic-outline" size={28} color="#10B981" />
                </View>
                <Text style={styles.addModalOptionTitle}>إدخال صوتي</Text>
                <Text style={styles.addModalOptionSubtitle}>تحدث وسنسجل لك</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Smart Add Modal */}
      <SmartAddModal
        visible={showSmartAdd}
        onClose={() => setShowSmartAdd(false)}
        onSuccess={() => {
          fetchExpenses(true);
        }}
      />
    </SafeAreaView>
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
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...getPlatformShadow('xs'),
    zIndex: 10,
  },
  dateFilterRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  filterTypeToggle: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.surfaceCard,
    ...getPlatformShadow('xs'),
  },
  toggleText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textMuted,
    fontWeight: getPlatformFontWeight('600'),
  },
  toggleTextActive: {
    color: theme.colors.primary,
  },
  monthFilterWrapper: {
    flex: 1,
    alignItems: isRTL ? 'flex-start' : 'flex-end',
  },
  daySelector: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  daySelectorText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
    fontWeight: getPlatformFontWeight('600'),
  },
  categoriesRow: {
    marginTop: 4,
    direction: "rtl"
  },
  categoriesContent: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
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
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipIcon: {
    marginHorizontal: 4,
  },
  categoryChipText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('600'),
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  listContent: {
    paddingBottom: 80,
  },
  itemWrapper: {
    paddingHorizontal: 20,
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
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  summaryAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 24,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFF',
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
  summaryCount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    color: 'rgba(255,255,255,1)',
    fontWeight: getPlatformFontWeight('600'),
  },
  summaryLoadedCount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    alignItems: isRTL ? 'flex-start' : 'flex-end',
    pointerEvents: 'box-none',
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 22,
    ...getPlatformShadow('lg'),
  },
  fabGradient: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  addModalContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  addModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  addModalTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  addModalOptions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingHorizontal: 20,
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
  footerContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadMoreText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: getPlatformFontWeight('600'),
    marginRight: 8,
  },
  endOfListContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    ...getPlatformShadow('xl'),
  },
  pickerHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerDoneText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
});
