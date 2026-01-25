import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  I18nManager,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Animated,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar, FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TransactionItem } from '../components/TransactionItem';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { getExpenses, deleteExpense, getCustomCategories, addCustomCategory, deleteCustomCategory, updateCustomCategory, CustomCategory } from '../database/database';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';
import { MonthFilter } from '../components/MonthFilter';
import { getMonthData } from '../services/financialService';

export const ExpensesScreen = ({ navigation, route }: any) => {
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const filterMenuAnim = useRef(new Animated.Value(0)).current;
  // Month filter state - default to current month
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  const loadExpenses = async () => {
    try {
      let expensesData = await getExpenses();
      
      // Get available months (months that have expenses)
      const monthsSet = new Set<string>();
      expensesData.forEach(expense => {
        const date = new Date(expense.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        monthsSet.add(`${year}-${month}`);
      });
      
      const months = Array.from(monthsSet).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month };
      });
      setAvailableMonths(months);
      
      // Filter by selected month if a month is selected
      if (selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0)) {
        const firstDay = new Date(selectedMonth.year, selectedMonth.month - 1, 1).toISOString().split('T')[0];
        const lastDay = new Date(selectedMonth.year, selectedMonth.month, 0).toISOString().split('T')[0];
        expensesData = expensesData.filter(
          (expense) => expense.date >= firstDay && expense.date <= lastDay
        );
      }
      
      setExpenses(expensesData);
      setFilteredExpenses(expensesData);
    } catch (error) {
      // Ignore error
    }
  };

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      // Ignore error
    }
  };

  useEffect(() => {
    loadExpenses();
    loadCustomCategories();
    const unsubscribe = navigation.addListener('focus', () => {
      loadExpenses();
      loadCustomCategories();
    });
    return unsubscribe;
  }, [navigation, selectedMonth]);

  useEffect(() => {
    if (route?.params?.expense) {
      navigation.navigate('AddExpense', { expense: route.params.expense });
      navigation.setParams({ expense: undefined });
    }
  }, [route?.params]);

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
        // Direct match
        if (expense.category === selectedCategory) {
          return true;
        }
        
        // Check if selectedCategory is an English key and match against Arabic label
        if (EXPENSE_CATEGORIES[selectedCategory as ExpenseCategory]) {
          const arabicLabel = EXPENSE_CATEGORIES[selectedCategory as ExpenseCategory];
          // Check if expense.category matches the Arabic label
          if (expense.category === arabicLabel) {
            return true;
          }
        }
        
        // Check if selectedCategory is an Arabic label and match against English key
        const englishKey = Object.keys(EXPENSE_CATEGORIES).find(
          key => EXPENSE_CATEGORIES[key as ExpenseCategory] === selectedCategory
        );
        if (englishKey && expense.category === englishKey) {
          return true;
        }
        
        // Check custom categories
        const customCategory = customCategories.find(c => c.name === selectedCategory);
        if (customCategory && expense.category === customCategory.name) {
          return true;
        }
        
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
  }, [showFilterMenu]);

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

  const categoryColors: Record<string, string[]> = {
    food: ['#F59E0B', '#D97706'],
    transport: ['#3B82F6', '#2563EB'],
    shopping: ['#EC4899', '#DB2777'],
    bills: ['#EF4444', '#DC2626'],
    entertainment: ['#8B5CF6', '#7C3AED'],
    health: ['#10B981', '#059669'],
    education: ['#06B6D4', '#0891B2'],
    other: ['#6B7280', '#4B5563'],
  };

  const handleCategorySelect = (category: ExpenseCategory | 'all') => {
    setSelectedCategory(category);
    setShowFilterMenu(false);
  };

  const getSelectedCategoryLabel = () => {
    if (selectedCategory === 'all') return 'الكل';
    if (EXPENSE_CATEGORIES[selectedCategory as ExpenseCategory]) {
      return EXPENSE_CATEGORIES[selectedCategory as ExpenseCategory];
    }
    const custom = customCategories.find(c => c.name === selectedCategory);
    return custom?.name || selectedCategory;
  };

  const handleAddCategory = async (name: string, icon: string, color: string, id?: number) => {
    try {
      if (id) {
        // Update existing category
        if (id === 0) {
          // This is a default category being converted to custom
          await addCustomCategory({ name, type: 'expense', icon, color });
          alertService.success('نجح', 'تم تحويل الفئة إلى فئة مخصصة');
        } else {
          await updateCustomCategory(id, { name, icon, color });
          alertService.success('نجح', 'تم تحديث الفئة بنجاح');
        }
      } else {
        // Add new category
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

  const handleEditDefaultCategory = async (key: string, name: string, icon: string, color: string) => {
    try {
      // Check if already exists as custom category
      const existing = customCategories.find(c => c.name === EXPENSE_CATEGORIES[key as ExpenseCategory]);
      if (existing) {
        await updateCustomCategory(existing.id, { name, icon, color });
        alertService.success('نجح', 'تم تحديث الفئة بنجاح');
      } else {
        // Convert default category to custom
        await addCustomCategory({ 
          name, 
          type: 'expense', 
          icon, 
          color 
        });
        alertService.success('نجح', 'تم تحويل الفئة إلى فئة مخصصة');
      }
      await loadCustomCategories();
    } catch (error: any) {
      alertService.error('خطأ', error.message || 'حدث خطأ أثناء حفظ الفئة');
    }
  };

  const handleDeleteDefaultCategory = async (key: string) => {
    // Check if exists as custom category and delete it
    const existing = customCategories.find(c => c.name === EXPENSE_CATEGORIES[key as ExpenseCategory]);
    if (existing) {
      await handleDeleteCategory(existing.id);
    } else {
      alertService.warning('تنبيه', 'لا يمكن حذف الفئات الافتراضية. يمكنك تحويلها إلى فئة مخصصة أولاً');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          {/* Settings Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ManageCategories', {
              type: 'expense',
              onCategoryChange: async () => {
                await loadCustomCategories();
              },
            })}
            style={styles.headerManageCategoriesButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED'] as any}
              style={styles.headerManageCategoriesGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="settings" size={20} color={theme.colors.textInverse} />
            </LinearGradient>
          </TouchableOpacity>

          {/* Month Filter */}
          <View style={styles.monthFilterContainer}>
            <MonthFilter
              selectedMonth={selectedMonth}
              onMonthChange={(year, month) => setSelectedMonth({ year, month })}
              showAllOption={true}
              availableMonths={availableMonths}
            />
          </View>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="البحث في المصاريف..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchBar}
              inputStyle={styles.searchInput}
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>

        {/* Filter Buttons Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
        >
          <TouchableOpacity
            onPress={() => handleCategorySelect('all')}
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
          {customCategories.slice(0, 10).map((category) => {
            const isSelected = selectedCategory === category.name;
            return (
              <TouchableOpacity
                key={category.id}
                onPress={() => handleCategorySelect(category.name as ExpenseCategory)}
                style={styles.filterButton}
                activeOpacity={0.7}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={[category.color, category.color] as any}
                    style={styles.filterButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={category.icon as any}
                      size={16}
                      color={theme.colors.textInverse}
                    />
                    <Text style={styles.filterButtonTextActive} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.filterButtonDefault}>
                    <Ionicons
                      name={`${category.icon}-outline` as any}
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.filterButtonText} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
                <ScrollView
                  style={styles.filterMenuScroll}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.filterMenuContent}
                >
                  <TouchableOpacity
                    onPress={() => handleCategorySelect('all')}
                    style={[
                      styles.filterMenuItem,
                      selectedCategory === 'all' && styles.filterMenuItemActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    {selectedCategory === 'all' ? (
                      <LinearGradient
                        colors={theme.gradients.primary as any}
                        style={styles.filterMenuItemGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons name="apps" size={22} color={theme.colors.textInverse} />
                        <Text style={styles.filterMenuItemTextActive}>الكل</Text>
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.textInverse} />
                      </LinearGradient>
                    ) : (
                      <View style={styles.filterMenuItemDefault}>
                        <Ionicons name="apps-outline" size={22} color={theme.colors.textSecondary} />
                        <Text style={styles.filterMenuItemText}>الكل</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {customCategories.map((category) => {
                    const isSelected = selectedCategory === category.name;
                    return (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => handleCategorySelect(category.name)}
                        style={[
                          styles.filterMenuItem,
                          isSelected && styles.filterMenuItemActive,
                        ]}
                        activeOpacity={0.7}
                      >
                        {isSelected ? (
                          <LinearGradient
                            colors={[category.color, category.color] as any}
                            style={styles.filterMenuItemGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            <Ionicons
                              name={category.icon as any}
                              size={22}
                              color={theme.colors.textInverse}
                            />
                            <Text style={styles.filterMenuItemTextActive}>{category.name}</Text>
                            <View style={styles.filterMenuItemActions}>
                              <Ionicons name="checkmark-circle" size={20} color={theme.colors.textInverse} />
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setShowFilterMenu(false);
                                  navigation.navigate('AddCategory', {
                                    category,
                                    type: 'expense',
                                    onSave: handleAddCategory,
                                  });
                                }}
                                style={styles.editCategoryButton}
                              >
                                <Ionicons name="create" size={18} color={theme.colors.textInverse} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  alertService.confirm(
                                    'حذف الفئة',
                                    `هل تريد حذف "${category.name}"؟`,
                                    () => handleDeleteCategory(category.id)
                                  );
                                }}
                                style={styles.deleteCategoryButton}
                              >
                                <Ionicons name="trash" size={18} color={theme.colors.textInverse} />
                              </TouchableOpacity>
                            </View>
                          </LinearGradient>
                        ) : (
                          <View style={styles.filterMenuItemDefault}>
                            <Ionicons
                              name={`${category.icon}-outline` as any}
                              size={22}
                              color={theme.colors.textSecondary}
                            />
                            <Text style={styles.filterMenuItemText}>{category.name}</Text>
                            <View style={styles.filterMenuItemActionsDefault}>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  setShowFilterMenu(false);
                                  navigation.navigate('AddCategory', {
                                    category,
                                    type: 'expense',
                                    onSave: handleAddCategory,
                                  });
                                }}
                                style={styles.editCategoryButtonDefault}
                              >
                                <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  alertService.confirm(
                                    'حذف الفئة',
                                    `هل تريد حذف "${category.name}"؟`,
                                    () => handleDeleteCategory(category.id)
                                  );
                                }}
                                style={styles.deleteCategoryButtonDefault}
                              >
                                <Ionicons name="trash-outline" size={18} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                            </View>
        </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => {
                      setShowFilterMenu(false);
                      navigation.navigate('AddCategory', {
                        type: 'expense',
                        onSave: handleAddCategory,
                      });
                    }}
                    style={styles.addCategoryButton}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669'] as any}
                      style={styles.addCategoryButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="add-circle" size={22} color={theme.colors.textInverse} />
                      <Text style={styles.addCategoryButtonText}>إضافة فئة جديدة</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      </View>

      <FlatList
        data={filteredExpenses}
        ListHeaderComponent={() => {
          const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
          return (
            <View style={styles.summaryCardContainer}>
              <LinearGradient
                colors={['#EF4444', '#DC2626', '#B91C1C'] as any}
                style={styles.summaryCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.summaryCardContent}>
                  <View style={styles.summaryCardHeader}>
                    <Ionicons name="trending-down" size={24} color={theme.colors.textInverse} />
                    <Text style={styles.summaryCardTitle}>إجمالي المصاريف</Text>
                  </View>
                  <Text style={styles.summaryCardAmount}>
                    {formatCurrency(totalAmount)}
                  </Text>
                  <Text style={styles.summaryCardCount}>
                    {filteredExpenses.length} {filteredExpenses.length === 1 ? 'مصروف' : 'مصروف'}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <TransactionItem
            item={item}
            type="expense"
            formatCurrency={formatCurrency}
            onEdit={() => {
              navigation.navigate('AddExpense', { expense: item });
            }}
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
        )}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              {/* Empty state icon */}
            </View>
          </View>
        }
      />

      <View style={styles.fabContainer}>
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.fabGradient}
        >
          <FAB
            style={styles.fab}
            icon="plus"
            onPress={() => navigation.navigate('AddExpense')}
            size="medium"
            color={theme.colors.textInverse}
          />
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    direction: 'ltr',
  },
  searchRow: {
    flexDirection: isRTL ? 'row' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  searchContainer: {
    flex: 1,
  },
  monthFilterContainer: {
    flexShrink: 0,
  },
  headerManageCategoriesButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceCard, // Required for Android elevation
    ...getPlatformShadow('md'),
  },
  headerManageCategoriesGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    width: 56,
    height: 56,
    ...getPlatformShadow('md'),
  },
  recurringButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  searchBar: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
  },
  searchInput: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    direction: 'rtl',
  },
  filterRow: {
    marginBottom: theme.spacing.md,
    direction: 'rtl',
  },
  filterRowContent: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    direction: 'rtl',
  },
  filterButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceCard, // Required for Android elevation
    maxHeight: 30, // Ensure minimum height for proper elevation
    ...getPlatformShadow('sm'),
    direction: 'rtl',
  },
  filterButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.md,
  },
  filterButtonDefault: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
    width: '100%',
    height: '100%',
    // borderRadius removed - parent already has it
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
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  filterMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  filterMenuContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  filterMenuHeader: {
    flexDirection: 'row-reverse',
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
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceCard, // Required for Android elevation
    ...getPlatformShadow('sm'),
  },
  filterMenuItemActive: {
    ...getPlatformShadow('md'),
  },
  filterMenuItemGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 56,
    gap: theme.spacing.md,
  },
  filterMenuItemDefault: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceLight,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 56,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  filterMenuItemText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    textAlign: 'right',
  },
  filterMenuItemTextActive: {
    flex: 1,
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    textAlign: 'right',
  },
  filterMenuItemActions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  deleteCategoryButton: {
    padding: theme.spacing.xs,
  },
  deleteCategoryButtonDefault: {
    padding: theme.spacing.xs,
  },
  editCategoryButton: {
    padding: theme.spacing.xs,
  },
  editCategoryButtonDefault: {
    padding: theme.spacing.xs,
  },
  filterMenuItemActionsDefault: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
  },
  addCategoryButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceCard, // Required for Android elevation
    ...getPlatformShadow('sm'),
  },
  addCategoryButtonGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: 56,
    gap: theme.spacing.sm,
  },
  addCategoryButtonText: {
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  summaryCardContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  summaryCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  summaryCardContent: {
    padding: theme.spacing.lg,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  summaryCardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summaryCardAmount: {
    fontSize: 32,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: theme.spacing.xs,
  },
  summaryCardCount: {
    fontSize: theme.typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  list: {
    flex: 1,
    paddingTop: theme.spacing.md,
    paddingHorizontal: 0,
    direction: 'rtl',
  },
  listContent: {
    paddingBottom: 120,
    paddingHorizontal: theme.spacing.sm,
  
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.surfaceLight,
  },
  fabContainer: {
    position: 'absolute',
    ...(I18nManager.isRTL ? { left: theme.spacing.lg } : { right: theme.spacing.lg }),
    bottom: theme.spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.gradients.primary[0], // Fallback color for Android elevation
    ...getPlatformShadow('lg'),
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fab: {
    backgroundColor: theme.gradients.primary[0],
  },
  manageCategoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  manageCategoriesButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  manageCategoriesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  manageCategoriesContainer: {
    maxHeight: '85%',
    width: '100%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  manageCategoriesGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  manageCategoriesScrollContainer: {
    flex: 1,
    maxHeight: '100%',
  },
  manageCategoriesHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexShrink: 0,
  },
  manageCategoriesTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  manageCategoriesCloseButton: {
    padding: theme.spacing.xs,
  },
  manageCategoriesScroll: {
    flex: 1,
  },
  manageCategoriesContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  emptyCategoriesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyCategoriesText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  emptyCategoriesSubtext: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  categoryManageItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryManageItemLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  categoryManageIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryManageInfo: {
    flex: 1,
  },
  categoryManageName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  categoryManageType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  categoryManageActions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.sm,
  },
  categoryManageEditButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryManageDeleteButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageCategoriesFooter: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  manageCategoriesAddButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  manageCategoriesAddGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  manageCategoriesAddText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  categoriesSection: {
    marginBottom: theme.spacing.xl,
  },
  categoriesSectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
});
