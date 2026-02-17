import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar, FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TransactionItem } from '../components/TransactionItem';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getExpenses, getExpensesByRange, getAvailableExpenseMonths, deleteExpense, getCustomCategories, addCustomCategory, deleteCustomCategory, updateCustomCategory, CustomCategory } from '../database/database';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';
import { MonthFilter } from '../components/MonthFilter';
import { getMonthRange } from '../utils/date';
import { SmartAddModal } from '../components/SmartAddModal';

export const ExpensesScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSmartAdd, setShowSmartAdd] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const filterMenuAnim = useRef(new Animated.Value(0)).current;
  const addModalAnim = useRef(new Animated.Value(0)).current;

  // Month filter state - default to current month
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  const loadExpenses = useCallback(async () => {
    try {
      const months = await getAvailableExpenseMonths();
      setAvailableMonths(months);

      let expensesData: Expense[] = [];

      // Filter by selected month if a month is selected
      if (selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0)) {
        const { firstDay, lastDay } = getMonthRange(selectedMonth.year, selectedMonth.month);

        expensesData = await getExpensesByRange(firstDay, lastDay);
      } else {
        expensesData = await getExpenses();
      }

      setExpenses(expensesData);
      setFilteredExpenses(expensesData);
    } catch (error) {
      // Ignore error
    }
  }, [selectedMonth]);

  const loadCustomCategories = useCallback(async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      // Ignore error
    }
  }, []);

  useEffect(() => {
    loadExpenses();
    loadCustomCategories();
    const unsubscribe = navigation.addListener('focus', () => {
      loadExpenses();
      loadCustomCategories();
    });
    return unsubscribe;
  }, [navigation, selectedMonth, loadExpenses, loadCustomCategories]);

  useEffect(() => {
    if (route?.params?.expense) {
      navigation.navigate('AddExpense', { expense: route.params.expense });
      navigation.setParams({ expense: undefined });
    }
  }, [route?.params, navigation]);

  useEffect(() => {
    let filtered = expenses;

    if (searchQuery) {
      filtered = filtered.filter(expense =>
        expense.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(expense => {
        const categoryToCheck = expense.category;

        // 1. Exact match (e.g. "طعام" === "طعام")
        if (categoryToCheck === selectedCategory) return true;

        // 2. Map English Key to Arabic Name (e.g. "food" maps to "طعام")
        // If the item has "food" and selectedCategory is "طعام"
        if (EXPENSE_CATEGORIES[categoryToCheck as ExpenseCategory] === selectedCategory) return true;

        // 3. Map Arabic Name to English Key (Reverse check)
        // If the item has "طعام" and selectedCategory is "food" (Unlikely if chips are from DB names)
        const englishKey = Object.keys(EXPENSE_CATEGORIES).find(
          key => EXPENSE_CATEGORIES[key as ExpenseCategory] === categoryToCheck
        );
        if (englishKey === selectedCategory) return true;

        // 4. Case-insensitive check
        if (categoryToCheck.toLowerCase() === selectedCategory.toLowerCase()) return true;

        return false;
      });
    }

    setFilteredExpenses(filtered);
  }, [expenses, searchQuery, selectedCategory, customCategories]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  useEffect(() => {
    if (showFilterMenu) {
      Animated.spring(filterMenuAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(filterMenuAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showFilterMenu, filterMenuAnim]);

  useEffect(() => {
    if (showAddModal) {
      Animated.spring(addModalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(addModalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showAddModal, addModalAnim]);

  const handleAddOption = (option: 'manual' | 'voice') => {
    setShowAddModal(false);
    if (option === 'manual') {
      navigation.navigate('AddExpense');
    } else {
      setShowSmartAdd(true);
    }
  };

  const handleCategorySelect = (category: ExpenseCategory | 'all') => {
    setSelectedCategory(category);
    setShowFilterMenu(false);
  };

  const handleAddCategory = async (name: string, icon: string, color: string, id?: number) => {
    try {
      if (id) {
        if (id === 0) {
          await addCustomCategory({ name, type: 'expense', icon, color });
        } else {
          await updateCustomCategory(id, { name, icon, color });
        }
        alertService.success('نجح', 'تم تحديث الفئة بنجاح');
      } else {
        await addCustomCategory({ name, type: 'expense', icon, color });
        alertService.success('نجح', 'تم إضافة الفئة بنجاح');
      }
      await loadCustomCategories();
    } catch (error: any) {
      alertService.error('خطأ', error.message || 'حدث خطأ أثناء حفظ الفئة');
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await deleteCustomCategory(categoryId);
      await loadCustomCategories();
      if (selectedCategory !== 'all' && customCategories.find(c => c.id === categoryId)?.name === selectedCategory) {
        setSelectedCategory('all');
      }
      alertService.success('نجح', 'تم حذف الفئة بنجاح');
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء حذف الفئة');
    }
  };

  const totalAmount = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + (expense.base_amount ?? expense.amount), 0),
    [filteredExpenses]
  );

  const renderListHeader = useCallback(() => (
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
            <Text style={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryCount}>
            {filteredExpenses.length} مصروف
          </Text>
        </View>
      </LinearGradient>
    </View>
  ), [filteredExpenses.length, formatCurrency, styles, totalAmount]);

  const renderExpenseItem = useCallback(({ item }: { item: Expense }) => (
    <TransactionItem
      item={item}
      type="expense"
      formatCurrency={formatCurrency}
      customCategories={customCategories}
      onEdit={() => navigation.navigate('AddExpense', { expense: item })}
      onDelete={async () => {
        try {
          await deleteExpense(item.id);
          await loadExpenses();
          alertService.success('نجح', 'تم حذف المصروف بنجاح');
        } catch (error) {
          alertService.error('خطأ', 'حدث خطأ أثناء حذف المصروف');
        }
      }}
    />
  ), [customCategories, formatCurrency, loadExpenses, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList
        data={filteredExpenses}
        ListHeaderComponent={
          <>
            {/* Header Section */}
            <View style={styles.header}>
              <View style={styles.searchFilterRow}>
                <Searchbar
                  placeholder="البحث في المصاريف..."
                  onChangeText={setSearchQuery}
                  value={searchQuery}
                  style={styles.searchBar}
                  inputStyle={styles.searchInput}
                  placeholderTextColor={theme.colors.textMuted}
                  iconColor={theme.colors.primary}
                />
                <View style={styles.monthFilterWrapper}>
                  <MonthFilter
                    selectedMonth={selectedMonth}
                    onMonthChange={(year, month) => setSelectedMonth({ year, month })}
                    showAllOption={true}
                    availableMonths={availableMonths}
                  />
                </View>
              </View>

              {/* Categories Horizontal Scroll */}
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
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="receipt-outline" size={64} color={theme.colors.primary + '40'} />
            </View>
            <Text style={styles.emptyText}>لا توجد مصاريف مسجلة</Text>
            <Text style={styles.emptySubtext}>اضغط على + لإضافة مصروف جديد لهذا الشهر</Text>
          </View>
        }
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
          style={styles.fabButton}
        >
          <LinearGradient
            colors={theme.gradients.primary as any}
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
          loadExpenses();
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...getPlatformShadow('sm'),
    zIndex: 10,
  },
  headerTopRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  manageButton: {
    padding: 8,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
  },
  searchFilterRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    elevation: 0,
    height: 48,
  },
  searchInput: {
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    height: 48,
    minHeight: 0,
  },
  monthFilterWrapper: {
    justifyContent: 'center',
  },
  categoriesRow: {
    marginTop: 4,
    direction: "rtl"
  },
  categoriesContent: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    gap: 8,
    paddingHorizontal: 4, // create space for shadow
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
    padding: 20,
    paddingBottom: 80, // Space for FAB
  },
  summaryContainer: {
    marginBottom: 20,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 12,
    ...getPlatformShadow('md'),
  },
  summaryContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 12 : 0,
    marginRight: isRTL ? 0 : 12,
  },
  summaryTextContainer: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  summaryAmount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 22,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFF',
  },
  summaryFooter: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 8,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  summaryCount: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
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
    bottom: 20,
    left: 24,
    right: 24,
    alignItems: isRTL ? 'flex-start' : 'flex-end',
    pointerEvents: 'box-none',
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 24,
    ...getPlatformShadow('lg'),
  },
  fabGradient: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal Styles (Preserved but updated to match theme)
  filterMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterMenuContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  filterMenuHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterMenuTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
  filterMenuContent: {
    padding: 20,
  },
  filterMenuItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: theme.colors.surfaceLight,
  },
  filterMenuItemActive: {
    backgroundColor: theme.colors.primary + '10',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },

  // Add Modal Styles
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
});
