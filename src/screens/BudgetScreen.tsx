import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { getBudgets, deleteBudget, Budget, getAvailableExpenseMonths } from '../database/database';
import { BudgetStatus } from '../services/budgetService';
import { useCurrency } from '../hooks/useCurrency';
import { EXPENSE_CATEGORIES } from '../types';
import { getCustomCategories } from '../database/database';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { MonthFilter } from '../components/MonthFilter';
import { getMonthData } from '../services/financialService';
import { usePrivacy } from '../context/PrivacyContext';

export const BudgetScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency, currencyCode } = useCurrency();
  const { isPrivacyEnabled } = usePrivacy();
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [filteredBudgets, setFilteredBudgets] = useState<BudgetStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [convertedAmounts, setConvertedAmounts] = useState<Record<number, number>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetStatus | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterMenuAnim = useRef(new Animated.Value(0)).current;
  // Month filter state - default to current month
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  const loadData = async () => {
    try {
      // Build available months from compact SQL result + budgets list (no full expenses scan).
      const [expenseMonths, allBudgets] = await Promise.all([
        getAvailableExpenseMonths(),
        getBudgets(),
      ]);

      const monthsMap = new Map<string, { year: number; month: number }>();
      expenseMonths.forEach(({ year, month }) => {
        monthsMap.set(`${year}-${month}`, { year, month });
      });
      allBudgets.forEach(budget => {
        const month = parseInt(budget.month, 10);
        if (!Number.isFinite(month)) return;
        monthsMap.set(`${budget.year}-${month}`, { year: budget.year, month });
      });

      const months = Array.from(monthsMap.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      setAvailableMonths(months);

      // Get month data based on selected month
      let monthData;
      let monthBudgets: any[] = [];

      if (selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0)) {
        // Specific month selected
        monthData = await getMonthData(selectedMonth.year, selectedMonth.month);
        const targetMonth = selectedMonth.month.toString().padStart(2, '0');
        const targetYear = selectedMonth.year;

        monthBudgets = await getBudgets(targetMonth, targetYear);
      } else {
        // "All" selected - get all budgets and all expenses
        const { getExpenses } = await import('../database/database');
        const allExpenses = await getExpenses();
        const allIncome = await (await import('../database/database')).getIncome();

        monthData = {
          expenses: allExpenses,
          income: allIncome,
        };

        monthBudgets = allBudgets; // Already loaded above
      }

      const customCats = await getCustomCategories('expense');
      setCustomCategories(customCats);

      // Calculate budget status for selected period
      const statuses = monthBudgets.map(budget => {
        const periodExpenses = monthData.expenses.filter(
          (expense) => {
            const expenseCat = expense.category;
            const budgetCat = budget.category;

            // Direct match
            if (expenseCat === budgetCat) return true;

            // Match English budget category with Arabic expense category
            if (EXPENSE_CATEGORIES[budgetCat as keyof typeof EXPENSE_CATEGORIES] === expenseCat) return true;

            // Match Arabic budget category with English expense category
            if (EXPENSE_CATEGORIES[expenseCat as keyof typeof EXPENSE_CATEGORIES] === budgetCat) return true;

            return false;
          }
        );
        const spent = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const remaining = budget.amount - spent;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        const isExceeded = spent > budget.amount;

        return {
          budget,
          spent,
          remaining,
          percentage,
          isExceeded,
        };
      });

      setBudgets(statuses);

      // Convert amounts for each budget
      const converted: Record<number, number> = {};
      for (const status of statuses) {
        const budgetCurrency = status.budget.currency || currencyCode;
        if (budgetCurrency !== currencyCode) {
          try {
            const convertedAmount = await convertCurrency(status.budget.amount, budgetCurrency, currencyCode);
            converted[status.budget.id] = convertedAmount;
          } catch (error) {
            
          }
        }
      }
      setConvertedAmounts(converted);
    } catch (error) {
      
      alertService.error('خطأ', 'حدث خطأ أثناء تحميل الميزانيات');
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, selectedMonth]);

  useEffect(() => {
    if (route?.params?.action === 'add') {
      navigation.navigate('AddBudget');
      navigation.setParams({ action: undefined });
    }
  }, [route?.params]);

  useEffect(() => {
    let filtered = budgets;

    if (searchQuery) {
      filtered = filtered.filter(budgetStatus => {
        const categoryName = getCategoryName(budgetStatus.budget.category);
        return categoryName.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(budgetStatus => budgetStatus.budget.category === selectedCategory);
    }

    setFilteredBudgets(filtered);
  }, [budgets, searchQuery, selectedCategory]);

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
  }, [showFilterMenu]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleEditBudget = (budgetStatus: BudgetStatus) => {
    setShowMenu(false);
    navigation.navigate('AddBudget', { budget: budgetStatus.budget });
  };

  const handleDeleteBudget = (budgetId: number) => {
    setBudgetToDelete(budgetId);
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const openMenu = (budgetStatus: BudgetStatus) => {
    setSelectedBudget(budgetStatus);
    setShowMenu(true);
  };

  const confirmDeleteBudget = async () => {
    if (budgetToDelete === null) return;

    try {
      await deleteBudget(budgetToDelete);
      await loadData();
      setShowDeleteConfirm(false);
      setBudgetToDelete(null);
      alertService.toastSuccess('تم حذف الميزانية بنجاح');
    } catch (error) {
      
      alertService.error('خطأ', 'حدث خطأ أثناء حذف الميزانية');
      setShowDeleteConfirm(false);
      setBudgetToDelete(null);
    }
  };

  const getCategoryName = (category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] ||
      customCategories.find(c => c.name === category)?.name ||
      category;
  };

  const getCategoryIcon = (category: string) => {
    const categoryIcons: Record<string, string> = {
      food: 'restaurant',
      transport: 'car',
      shopping: 'bag',
      bills: 'receipt',
      entertainment: 'musical-notes',
      health: 'medical',
      education: 'school',
      other: 'ellipse',
    };
    return categoryIcons[category] || customCategories.find(c => c.name === category)?.icon || 'ellipse';
  };

  const allCategories = customCategories.map(c => c.name);

  const getSelectedCategoryLabel = () => {
    if (selectedCategory === 'all') return 'الكل';
    return getCategoryName(selectedCategory);
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.budget.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;

  const renderBudget = ({ item }: { item: BudgetStatus }) => {
    const percentage = Math.min(item.percentage, 100);
    const isExceeded = item.isExceeded;
    const isWarning = item.percentage >= 80 && !isExceeded;

    return (
      <View
        style={[
          styles.budgetCard,
          isExceeded && styles.budgetCardExceeded,
          isWarning && styles.budgetCardWarning,
        ]}
      >
        <View style={styles.budgetHeader}>
          <View style={styles.budgetCategory}>
            <View style={[
              styles.categoryIcon,
              { backgroundColor: isExceeded ? theme.colors.error + '15' : isWarning ? theme.colors.warning + '15' : theme.colors.primary + '15' }
            ]}>
              <Ionicons
                name={getCategoryIcon(item.budget.category) as any}
                size={24}
                color={isExceeded ? theme.colors.error : isWarning ? theme.colors.warning : theme.colors.primary}
              />
            </View>
            <View style={styles.budgetInfo}>
              <Text style={styles.budgetCategoryName}>
                {getCategoryName(item.budget.category)}
              </Text>
              <Text style={styles.budgetPercentage}>
                {isPrivacyEnabled ? '**% مستخدم' : `${percentage.toFixed(1)}% مستخدم`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => openMenu(item)}
            style={styles.menuButton}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.budgetProgress}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${percentage}%`,
                  backgroundColor: isExceeded
                    ? theme.colors.error
                    : isWarning
                      ? theme.colors.warning
                      : theme.colors.primary,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.budgetDetails}>
          <View style={styles.budgetDetailItem}>
            <Text style={styles.budgetDetailLabel}>الميزانية</Text>
            <View>
              <Text style={styles.budgetDetailValue}>
                {isPrivacyEnabled ? '****' : formatCurrencyAmount(item.budget.amount, item.budget.currency || currencyCode)}
              </Text>
              {convertedAmounts[item.budget.id] && item.budget.currency !== currencyCode && (
                <Text style={styles.convertedAmountText}>
                  ≈ {formatCurrency(convertedAmounts[item.budget.id])}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.budgetDetailItem}>
            <Text style={styles.budgetDetailLabel}>المصروف</Text>
            <Text style={[styles.budgetDetailValue, { color: theme.colors.error }]}>
              {formatCurrency(item.spent)}
            </Text>
          </View>
          <View style={styles.budgetDetailItem}>
            <Text style={styles.budgetDetailLabel}>المتبقي</Text>
            <Text
              style={[
                styles.budgetDetailValue,
                { color: item.remaining >= 0 ? theme.colors.success : theme.colors.error },
              ]}
            >
              {formatCurrency(item.remaining)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>

      <FlashList
        data={filteredBudgets}
        // @ts-ignore
        estimatedItemSize={180}
        ListHeaderComponent={
          <View style={styles.header}>

            {/* Month Filter */}
            <View style={styles.monthFilterContainer}>
              <MonthFilter
                selectedMonth={selectedMonth}
                onMonthChange={(year, month) => setSelectedMonth({ year, month })}
                showAllOption={true}
                availableMonths={availableMonths}
              />
            </View>

            {/* Filter Buttons Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterRowContent}
            >
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory('all');
                }}
                style={styles.filterButton}
                activeOpacity={0.7}
              >
                {selectedCategory === 'all' ? (
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.filterButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="apps" size={16} color="#FFFFFF" />
                    <Text style={styles.filterButtonTextActive}>الكل</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.filterButtonDefault}>
                    <Ionicons name="apps-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.filterButtonText}>الكل</Text>
                  </View>
                )}
              </TouchableOpacity>
              {allCategories.map((category) => {
                const isSelected = selectedCategory === category;
                return (
                  <TouchableOpacity
                    key={category}
                    onPress={() => {
                      setSelectedCategory(category);
                    }}
                    style={styles.filterButton}
                    activeOpacity={0.7}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={theme.gradients.info as any}
                        style={styles.filterButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons
                          name={getCategoryIcon(category) as any}
                          size={16}
                          color="#FFFFFF"
                        />
                        <Text style={styles.filterButtonTextActive} numberOfLines={1}>
                          {getCategoryName(category)}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.filterButtonDefault}>
                        <Ionicons
                          name={getCategoryIcon(category) as any}
                          size={16}
                          color={theme.colors.textSecondary}
                        />
                        <Text style={styles.filterButtonText} numberOfLines={1}>
                          {getCategoryName(category)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>إجمالي الميزانية</Text>
                <Text style={styles.summaryAmount}>{formatCurrency(totalBudget)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>المصروف</Text>
                <Text style={[styles.summaryAmount, { color: theme.colors.error }]}>
                  {formatCurrency(totalSpent)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>المتبقي</Text>
                <Text style={[
                  styles.summaryAmount,
                  { color: totalRemaining >= 0 ? theme.colors.success : theme.colors.error }
                ]}>
                  {formatCurrency(totalRemaining)}
                </Text>
              </View>
            </View>
          </View>
        }
        renderItem={renderBudget}
        keyExtractor={(item) => item.budget.id.toString()}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={80} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>
              {selectedCategory !== 'all' ? 'لا توجد نتائج' : 'لا توجد ميزانيات محددة'}
            </Text>
            <Text style={styles.emptySubtext}>
              {selectedCategory !== 'all'
                ? 'جرب تغيير الفلتر'
                : 'أضف ميزانية جديدة لتتبع إنفاقك'}
            </Text>
          </View>
        }
      />

      {/* Pro Bottom Sheet Menu */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.dragHandle} />
            <Text style={styles.menuHeaderTitle}>خيارات الميزانية</Text>

            <View style={styles.menuOptionsList}>
              {selectedBudget && (
                <>
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={() => handleEditBudget(selectedBudget)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                      <Ionicons name="create-outline" size={22} color={theme.colors.primary} />
                    </View>
                    <View style={styles.menuOptionTextContainer}>
                      <Text style={styles.menuOptionTitle}>تعديل</Text>
                      <Text style={styles.menuOptionSubtitle}>تغيير تفاصيل الميزانية أو المبلغ</Text>
                    </View>
                    <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuOption, { marginTop: 8 }]}
                    onPress={() => handleDeleteBudget(selectedBudget.budget.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuIconBox, { backgroundColor: theme.colors.error + '15' }]}>
                      <Ionicons name="trash-outline" size={22} color={theme.colors.error} />
                    </View>
                    <View style={styles.menuOptionTextContainer}>
                      <Text style={[styles.menuOptionTitle, { color: theme.colors.error }]}>حذف</Text>
                      <Text style={styles.menuOptionSubtitle}>حذف هذه الميزانية نهائياً</Text>
                    </View>
                    <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.closeButtonText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmAlert
        visible={showDeleteConfirm}
        title="تأكيد الحذف"
        message="هل أنت متأكد من حذف هذه الميزانية؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={confirmDeleteBudget}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setBudgetToDelete(null);
        }}
        type="danger"
      />
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    direction: 'rtl',
  },
  header: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    direction: 'rtl',
  },
  headerTitleRow: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  pageTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  pageSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  searchContainer: {
    marginBottom: theme.spacing.sm,
    direction: 'ltr',
  },
  monthFilterContainer: {
    marginBottom: theme.spacing.md,
    alignItems: 'flex-start',
  },
  filterRow: {
    marginBottom: theme.spacing.md,
    direction: 'rtl' as const,
  },
  filterRowContent: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  filterButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  filterButtonGradient: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  filterButtonDefault: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  filterButtonText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  filterButtonTextActive: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  summaryRow: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    gap: theme.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'right',
  },
  summaryAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingTop: 0,
  },
  budgetCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceCard,
    ...getPlatformShadow('md'),
    direction: 'rtl',
  },
  budgetCardExceeded: {
    borderWidth: 2,
    borderColor: theme.colors.error + '30',
  },
  budgetCardWarning: {
    borderWidth: 2,
    borderColor: theme.colors.warning + '30',
  },
  budgetHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  budgetCategory: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetInfo: {
    flex: 1,
  },
  budgetCategoryName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    textAlign: 'left',
  },
  budgetPercentage: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'left',
  },
  menuButton: {
    padding: theme.spacing.xs,
  },
  budgetProgress: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.border,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetDetails: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  budgetDetailItem: {
    alignItems: 'center',
  },
  budgetDetailLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  budgetDetailValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily,
  },
  emptySubtext: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily,
  },
  filterMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterMenuContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '70%',
  },
  filterMenuHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterMenuTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  filterMenuCloseButton: {
    padding: theme.spacing.xs,
  },
  filterMenuScroll: {
    maxHeight: 400,
  },
  filterMenuContent: {
    padding: theme.spacing.md,
  },
  filterMenuItem: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  filterMenuItemActive: {
    ...getPlatformShadow('md'),
  },
  filterMenuItemGradient: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterMenuItemDefault: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    gap: theme.spacing.sm,
  },
  filterMenuItemText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  filterMenuItemTextActive: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 12,
    ...getPlatformShadow('lg'),
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  menuHeaderTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  menuOptionsList: {
    paddingHorizontal: theme.spacing.lg,
    direction: 'ltr',
  },
  menuOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: theme.spacing.md,
    ...getPlatformShadow('xs'),
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? theme.spacing.md : 0,
    marginRight: isRTL ? 0 : theme.spacing.md,
  },
  menuOptionTextContainer: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    marginBottom: 2,
  },
  menuOptionSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  closeButton: {
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    ...getPlatformShadow('xs'),
  },
  closeButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});
