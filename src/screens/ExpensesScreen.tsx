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
import { AddExpenseModal } from '../components/AddExpenseModal';
import { AddCategoryModal } from '../components/AddCategoryModal';
import { theme } from '../utils/theme';
import { getExpenses, deleteExpense, getCustomCategories, addCustomCategory, deleteCustomCategory, CustomCategory } from '../database/database';
import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';

export const ExpensesScreen = ({ navigation, route }: any) => {
  const { formatCurrency } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const filterMenuAnim = useRef(new Animated.Value(0)).current;

  const loadExpenses = async () => {
    try {
      const expensesData = await getExpenses();
      setExpenses(expensesData);
      setFilteredExpenses(expensesData);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      console.error('Error loading custom categories:', error);
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
  }, [navigation]);

  useEffect(() => {
    if (route?.params?.expense) {
      setEditingExpense(route.params.expense);
      setShowAddModal(true);
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
      filtered = filtered.filter(expense => expense.category === selectedCategory);
    }

    setFilteredExpenses(filtered);
  }, [expenses, searchQuery, selectedCategory]);

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

  const handleAddCategory = async (name: string, icon: string, color: string) => {
    try {
      await addCustomCategory({ name, type: 'expense', icon, color });
      await loadCustomCategories();
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء إضافة الفئة');
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await deleteCustomCategory(categoryId);
      await loadCustomCategories();
      if (selectedCategory !== 'all' && customCategories.find(c => c.id === categoryId)?.name === selectedCategory) {
        setSelectedCategory('all');
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حذف الفئة');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
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
          <TouchableOpacity
            onPress={() => navigation.navigate('RecurringExpenses')}
            style={styles.recurringButton}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED'] as any}
              style={styles.recurringButtonGradient}
            >
              <Ionicons name="repeat" size={20} color={theme.colors.textInverse} />
            </LinearGradient>
          </TouchableOpacity>
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
          {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => {
            const isSelected = selectedCategory === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleCategorySelect(key as ExpenseCategory)}
                style={styles.filterButton}
                activeOpacity={0.7}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={(categoryColors[key] || theme.gradients.primary) as any}
                    style={styles.filterButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={categoryIcons[key] as any}
                      size={16}
                      color={theme.colors.textInverse}
                    />
                    <Text style={styles.filterButtonTextActive} numberOfLines={1}>
                      {label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.filterButtonDefault}>
                    <Ionicons
                      name={`${categoryIcons[key]}-outline` as any}
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.filterButtonText} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {customCategories.slice(0, 5).map((category) => {
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
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => {
                    const isSelected = selectedCategory === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => handleCategorySelect(key as ExpenseCategory)}
                        style={[
                          styles.filterMenuItem,
                          isSelected && styles.filterMenuItemActive,
                        ]}
                        activeOpacity={0.7}
                      >
                        {isSelected ? (
                          <LinearGradient
                            colors={(categoryColors[key] || theme.gradients.primary) as any}
                            style={styles.filterMenuItemGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            <Ionicons
                              name={categoryIcons[key] as any}
                              size={22}
                              color={theme.colors.textInverse}
                            />
                            <Text style={styles.filterMenuItemTextActive}>{label}</Text>
                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.textInverse} />
                          </LinearGradient>
                        ) : (
                          <View style={styles.filterMenuItemDefault}>
                            <Ionicons
                              name={`${categoryIcons[key]}-outline` as any}
                              size={22}
                              color={theme.colors.textSecondary}
                            />
                            <Text style={styles.filterMenuItemText}>{label}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
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
                                  Alert.alert(
                                    'حذف الفئة',
                                    `هل تريد حذف "${category.name}"؟`,
                                    [
                                      { text: 'إلغاء', style: 'cancel' },
                                      {
                                        text: 'حذف',
                                        style: 'destructive',
                                        onPress: () => handleDeleteCategory(category.id),
                                      },
                                    ]
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
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                Alert.alert(
                                  'حذف الفئة',
                                  `هل تريد حذف "${category.name}"؟`,
                                  [
                                    { text: 'إلغاء', style: 'cancel' },
                                    {
                                      text: 'حذف',
                                      style: 'destructive',
                                      onPress: () => handleDeleteCategory(category.id),
                                    },
                                  ]
                                );
                              }}
                              style={styles.deleteCategoryButtonDefault}
                            >
                              <Ionicons name="trash-outline" size={18} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
        </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => {
                      setShowFilterMenu(false);
                      setShowAddCategoryModal(true);
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
        renderItem={({ item }) => (
          <TransactionItem
            item={item}
            type="expense"
            formatCurrency={formatCurrency}
            onEdit={() => {
              setEditingExpense(item);
              setShowAddModal(true);
            }}
            onDelete={async () => {
              try {
                await deleteExpense(item.id);
                await loadExpenses();
                alertService.success('نجح', 'تم حذف المصروف بنجاح');
              } catch (error) {
                console.error('Error deleting expense:', error);
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

      <LinearGradient
        colors={theme.gradients.primary as any}
        style={styles.fabGradient}
      >
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={() => setShowAddModal(true)}
          size="medium"
          color={theme.colors.textInverse}
        />
      </LinearGradient>

      <AddExpenseModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingExpense(null);
        }}
        expense={editingExpense}
        onSave={loadExpenses}
      />

      <AddCategoryModal
        visible={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onSave={handleAddCategory}
        type="expense"
      />
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
    direction: 'rtl',
  },
  searchRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  searchContainer: {
    flex: 1,
  },
  recurringButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    width: 56,
    height: 56,
    ...theme.shadows.md,
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  filterButtonDefault: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
    ...theme.shadows.lg,
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
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  filterMenuItemActive: {
    ...theme.shadows.md,
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
    fontWeight: '600',
    textAlign: 'right',
  },
  filterMenuItemTextActive: {
    flex: 1,
    color: theme.colors.textInverse,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '700',
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
  addCategoryButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
    ...theme.shadows.sm,
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
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingTop: theme.spacing.md,
    paddingHorizontal: 0,
    direction: 'ltr',
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
  fabGradient: {
    position: 'absolute',
    ...(I18nManager.isRTL ? { left: theme.spacing.lg } : { right: theme.spacing.lg }),
    bottom: theme.spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  fab: {
    backgroundColor: 'transparent',
  },
});
