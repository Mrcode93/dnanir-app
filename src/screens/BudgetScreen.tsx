import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Animated,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { getBudgets, deleteBudget, Budget } from '../database/database';
import { calculateBudgetStatus, BudgetStatus } from '../services/budgetService';
import { useCurrency } from '../hooks/useCurrency';
import { EXPENSE_CATEGORIES } from '../types';
import { getCustomCategories } from '../database/database';
import { AddBudgetModal } from '../components/AddBudgetModal';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { MonthFilter } from '../components/MonthFilter';
import { getMonthData } from '../services/financialService';

export const BudgetScreen = ({ navigation, route }: any) => {
  const { formatCurrency, currencyCode } = useCurrency();
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [filteredBudgets, setFilteredBudgets] = useState<BudgetStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
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
      // Get available months (months that have expenses or budgets)
      const { getExpenses, getBudgets } = await import('../database/database');
      const allExpenses = await getExpenses();
      const allBudgets = await getBudgets();
      
      const monthsSet = new Set<string>();
      // Add months from expenses
      allExpenses.forEach(expense => {
        const date = new Date(expense.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        monthsSet.add(`${year}-${month}`);
      });
      // Add months from budgets
      allBudgets.forEach(budget => {
        monthsSet.add(`${budget.year}-${parseInt(budget.month)}`);
      });
      
      const months = Array.from(monthsSet).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month };
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
        
        // Get budgets for the selected month
        const { getBudgets } = await import('../database/database');
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
        
        // Get all budgets
        const { getBudgets } = await import('../database/database');
        monthBudgets = await getBudgets(); // No parameters = all budgets
      }
      
      // Calculate budget status for selected period
      const statuses = monthBudgets.map(budget => {
        const periodExpenses = monthData.expenses.filter(
          (expense) => expense.category === budget.category
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
      
      const customCats = await getCustomCategories('expense');
      setCustomCategories(customCats);

      // Convert amounts for each budget
      const converted: Record<number, number> = {};
      for (const status of statuses) {
        const budgetCurrency = status.budget.currency || currencyCode;
        if (budgetCurrency !== currencyCode) {
          try {
            const convertedAmount = await convertCurrency(status.budget.amount, budgetCurrency, currencyCode);
            converted[status.budget.id] = convertedAmount;
          } catch (error) {
            console.error('Error converting currency:', error);
          }
        }
      }
      setConvertedAmounts(converted);
    } catch (error) {
      console.error('Error loading budgets:', error);
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
      setEditingBudget(null);
      setShowAddModal(true);
      navigation.setParams({ action: undefined });
    }
  }, [route?.params]);

  useLayoutEffect(() => {
    const parent = navigation.getParent();
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
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
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
    setEditingBudget(budgetStatus.budget);
    setShowAddModal(true);
    setShowMenu(false);
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
      alertService.success('نجح', 'تم حذف الميزانية بنجاح');
    } catch (error) {
      console.error('Error deleting budget:', error);
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

  const allCategories = [
    ...Object.keys(EXPENSE_CATEGORIES),
    ...customCategories.map(c => c.name),
  ];

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
              { backgroundColor: isExceeded ? '#FEE2E2' : isWarning ? '#FEF3C7' : '#E0E7FF' }
            ]}>
              <Ionicons
                name={getCategoryIcon(item.budget.category) as any}
                size={24}
                color={isExceeded ? '#EF4444' : isWarning ? '#F59E0B' : theme.colors.primary}
              />
            </View>
            <View style={styles.budgetInfo}>
              <Text style={styles.budgetCategoryName}>
                {getCategoryName(item.budget.category)}
              </Text>
              <Text style={styles.budgetPercentage}>
                {percentage.toFixed(1)}% مستخدم
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
                    ? '#EF4444'
                    : isWarning
                    ? '#F59E0B'
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
                {formatCurrencyAmount(item.budget.amount, item.budget.currency || currencyCode)}
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
            <Text style={[styles.budgetDetailValue, { color: '#EF4444' }]}>
              {formatCurrency(item.spent)}
            </Text>
          </View>
          <View style={styles.budgetDetailItem}>
            <Text style={styles.budgetDetailLabel}>المتبقي</Text>
            <Text
              style={[
                styles.budgetDetailValue,
                { color: item.remaining >= 0 ? '#10B981' : '#EF4444' },
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
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with Search and Filter */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="البحث في الميزانيات..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
        
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
                <Ionicons name="apps" size={16} color={theme.colors.textInverse} />
                <Text style={styles.filterButtonTextActive}>الكل</Text>
              </LinearGradient>
            ) : (
              <View style={styles.filterButtonDefault}>
                <Ionicons name="apps-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.filterButtonText}>الكل</Text>
              </View>
            )}
          </TouchableOpacity>
          {allCategories.slice(0, 8).map((category) => {
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
                      color={theme.colors.textInverse}
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
            <Text style={[styles.summaryAmount, { color: '#EF4444' }]}>
              {formatCurrency(totalSpent)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>المتبقي</Text>
            <Text style={[
              styles.summaryAmount,
              { color: totalRemaining >= 0 ? '#10B981' : '#EF4444' }
            ]}>
              {formatCurrency(totalRemaining)}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter Menu Modal */}
      <Modal
        visible={showFilterMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFilterMenu(false)}
      >
        <Pressable
          style={styles.filterMenuOverlay}
          onPress={() => setShowFilterMenu(false)}
        >
          <Animated.View
            style={[
              styles.filterMenuContainer,
              {
                opacity: filterMenuAnim,
                transform: [
                  {
                    scale: filterMenuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.filterMenuHeader}>
                <Text style={styles.filterMenuTitle}>اختر الفئة</Text>
                <TouchableOpacity
                  onPress={() => setShowFilterMenu(false)}
                  style={styles.filterMenuCloseButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.filterMenuScroll} contentContainerStyle={styles.filterMenuContent}>
                <Pressable
                  onPress={() => {
                    setSelectedCategory('all');
                    setShowFilterMenu(false);
                  }}
                  style={styles.filterMenuItem}
                >
                  <View style={[
                    styles.filterMenuItemDefault,
                    selectedCategory === 'all' && styles.filterMenuItemActive
                  ]}>
                    <Ionicons 
                      name="apps" 
                      size={20} 
                      color={selectedCategory === 'all' ? theme.colors.textInverse : theme.colors.textPrimary} 
                    />
                    <Text style={[
                      styles.filterMenuItemText,
                      selectedCategory === 'all' && styles.filterMenuItemTextActive
                    ]}>
                      الكل
                    </Text>
                  </View>
                </Pressable>
                {allCategories.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => {
                      setSelectedCategory(category);
                      setShowFilterMenu(false);
                    }}
                    style={styles.filterMenuItem}
                  >
                    {selectedCategory === category ? (
                      <LinearGradient
                        colors={theme.gradients.info as any}
                        style={styles.filterMenuItemGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons 
                          name={getCategoryIcon(category) as any} 
                          size={20} 
                          color={theme.colors.textInverse} 
                        />
                        <Text style={styles.filterMenuItemTextActive}>
                          {getCategoryName(category)}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={styles.filterMenuItemDefault}>
                        <Ionicons 
                          name={getCategoryIcon(category) as any} 
                          size={20} 
                          color={theme.colors.textPrimary} 
                        />
                        <Text style={styles.filterMenuItemText}>
                          {getCategoryName(category)}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <FlatList
        data={filteredBudgets}
        renderItem={renderBudget}
        keyExtractor={(item) => item.budget.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={80} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'all' ? 'لا توجد نتائج' : 'لا توجد ميزانيات محددة'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || selectedCategory !== 'all' 
                ? 'جرب البحث بكلمات مختلفة أو تغيير الفلتر'
                : 'أضف ميزانية جديدة لتتبع إنفاقك'}
            </Text>
          </View>
        }
      />

      <AddBudgetModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingBudget(null);
        }}
        budget={editingBudget}
        onSave={loadData}
      />

      {/* Options Menu */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            {selectedBudget && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleEditBudget(selectedBudget)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                  <Text style={styles.menuItemText}>تعديل</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuItemDanger]}
                  onPress={() => handleDeleteBudget(selectedBudget.budget.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                  <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>حذف</Text>
                </TouchableOpacity>
              </>
            )}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
    fontWeight: '700',
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
  },
  monthFilterContainer: {
    marginBottom: theme.spacing.md,
    alignItems: 'flex-start',
  },
  searchBar: {
    backgroundColor: theme.colors.surfaceLight,
    elevation: 0,
    borderRadius: theme.borderRadius.md,
  },
  searchInput: {
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'left' : 'right',
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
    ...theme.shadows.sm,
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
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  filterButtonTextActive: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
    color: theme.colors.textInverse,
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
    fontWeight: '700',
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
    ...theme.shadows.md,
  },
  budgetCardExceeded: {
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  budgetCardWarning: {
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  budgetHeader: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  budgetCategory: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
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
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  budgetPercentage: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    ...theme.shadows.md,
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
    fontWeight: '600',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    minWidth: 150,
    ...theme.shadows.lg,
  },
  menuItem: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  menuItemDanger: {
    marginTop: theme.spacing.xs,
  },
  menuItemText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    textAlign: 'right',
    color: theme.colors.textPrimary,
  },
  menuItemTextDanger: {
    color: theme.colors.error,
  },
});
