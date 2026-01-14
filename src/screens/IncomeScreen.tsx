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
import { AddIncomeModal } from '../components/AddIncomeModal';
import { AddCategoryModal } from '../components/AddCategoryModal';
import { theme } from '../utils/theme';
import { getIncome, deleteIncome, getCustomCategories, addCustomCategory, deleteCustomCategory, updateCustomCategory, CustomCategory } from '../database/database';
import { Income, IncomeSource, INCOME_SOURCES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';
import { MonthFilter } from '../components/MonthFilter';

export const IncomeScreen = ({ navigation, route }: any) => {
  const { formatCurrency } = useCurrency();
  const [income, setIncome] = useState<Income[]>([]);
  const [filteredIncome, setFilteredIncome] = useState<Income[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<IncomeSource | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showManageCategoriesModal, setShowManageCategoriesModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [allCategories, setAllCategories] = useState<CustomCategory[]>([]);
  const filterMenuAnim = useRef(new Animated.Value(0)).current;
  // Month filter state - default to current month
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([]);

  const loadIncome = async () => {
    try {
      let incomeData = await getIncome();
      
      // Get available months (months that have income)
      const monthsSet = new Set<string>();
      incomeData.forEach(income => {
        const date = new Date(income.date);
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
        incomeData = incomeData.filter(
          (income) => income.date >= firstDay && income.date <= lastDay
        );
      }
      
      setIncome(incomeData);
      setFilteredIncome(incomeData);
    } catch (error) {
      // Ignore error
    }
  };

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('income');
      setCustomCategories(categories);
      setAllCategories(categories);
    } catch (error) {
      // Ignore error
    }
  };

  useEffect(() => {
    loadIncome();
    loadCustomCategories();
    const unsubscribe = navigation.addListener('focus', () => {
      loadIncome();
      loadCustomCategories();
    });
    return unsubscribe;
  }, [navigation, selectedMonth]);

  useEffect(() => {
    if (route?.params?.income) {
      setEditingIncome(route.params.income);
      setShowAddModal(true);
      navigation.setParams({ income: undefined });
    }
  }, [route?.params]);

  useEffect(() => {
    let filtered = income;

    if (searchQuery) {
      filtered = filtered.filter(incomeItem =>
        incomeItem.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incomeItem.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedSource !== 'all') {
      filtered = filtered.filter(incomeItem => incomeItem.source === selectedSource);
    }

    setFilteredIncome(filtered);
  }, [income, searchQuery, selectedSource]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadIncome();
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

  const sourceIcons: Record<string, string> = {
    salary: 'cash',
    business: 'briefcase',
    investment: 'trending-up',
    gift: 'gift',
    other: 'ellipse',
  };

  const sourceColors: Record<string, string[]> = {
    salary: ['#10B981', '#059669'],
    business: ['#3B82F6', '#2563EB'],
    investment: ['#8B5CF6', '#7C3AED'],
    gift: ['#EC4899', '#DB2777'],
    other: ['#6B7280', '#4B5563'],
  };

  const handleSourceSelect = (source: IncomeSource | 'all') => {
    setSelectedSource(source);
    setShowFilterMenu(false);
  };

  const getSelectedSourceLabel = () => {
    if (selectedSource === 'all') return 'الكل';
    if (INCOME_SOURCES[selectedSource as IncomeSource]) {
      return INCOME_SOURCES[selectedSource as IncomeSource];
    }
    const custom = customCategories.find(c => c.name === selectedSource);
    return custom?.name || selectedSource;
  };

  const handleAddCategory = async (name: string, icon: string, color: string, id?: number) => {
    try {
      if (id) {
        // Update existing category
        if (id === 0) {
          // This is a default category being converted to custom
          await addCustomCategory({ name, type: 'income', icon, color });
          alertService.success('نجح', 'تم تحويل المصدر إلى مصدر مخصص');
        } else {
          await updateCustomCategory(id, { name, icon, color });
          alertService.success('نجح', 'تم تحديث المصدر بنجاح');
        }
      } else {
        // Add new category
        await addCustomCategory({ name, type: 'income', icon, color });
        alertService.success('نجح', 'تم إضافة المصدر بنجاح');
      }
      await loadCustomCategories();
      setEditingCategory(null);
    } catch (error: any) {
      alertService.error('خطأ', error.message || 'حدث خطأ أثناء حفظ المصدر');
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await deleteCustomCategory(categoryId);
      await loadCustomCategories();
      if (selectedSource !== 'all' && customCategories.find(c => c.id === categoryId)?.name === selectedSource) {
        setSelectedSource('all');
      }
      alertService.success('نجح', 'تم حذف المصدر بنجاح');
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء حذف المصدر');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="البحث في الدخل..."
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
          
          {/* Manage Categories Button */}
          <TouchableOpacity
            onPress={() => setShowManageCategoriesModal(true)}
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
        </View>

        {/* Filter Buttons Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
        >
          <TouchableOpacity
            onPress={() => handleSourceSelect('all')}
            style={styles.filterButton}
            activeOpacity={0.7}
          >
            {selectedSource === 'all' ? (
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
          {Object.entries(INCOME_SOURCES).map(([key, label]) => {
            const isSelected = selectedSource === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => handleSourceSelect(key as IncomeSource)}
                style={styles.filterButton}
                activeOpacity={0.7}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={(sourceColors[key] || theme.gradients.primary) as any}
                    style={styles.filterButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={sourceIcons[key] as any}
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
                      name={`${sourceIcons[key]}-outline` as any}
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
            const isSelected = selectedSource === category.name;
            return (
              <TouchableOpacity
                key={category.id}
                onPress={() => handleSourceSelect(category.name as IncomeSource)}
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
                  <Text style={styles.filterMenuTitle}>اختر نوع المصدر</Text>
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
                    onPress={() => handleSourceSelect('all')}
                    style={[
                      styles.filterMenuItem,
                      selectedSource === 'all' && styles.filterMenuItemActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    {selectedSource === 'all' ? (
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
                  {Object.entries(INCOME_SOURCES).map(([key, label]) => {
                    const isSelected = selectedSource === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => handleSourceSelect(key as IncomeSource)}
                        style={[
                          styles.filterMenuItem,
                          isSelected && styles.filterMenuItemActive,
                        ]}
                        activeOpacity={0.7}
                      >
                        {isSelected ? (
                          <LinearGradient
                            colors={(sourceColors[key] || theme.gradients.primary) as any}
                            style={styles.filterMenuItemGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                          >
                            <Ionicons
                              name={sourceIcons[key] as any}
                              size={22}
                              color={theme.colors.textInverse}
                            />
                            <Text style={styles.filterMenuItemTextActive}>{label}</Text>
                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.textInverse} />
                          </LinearGradient>
                        ) : (
                          <View style={styles.filterMenuItemDefault}>
                            <Ionicons
                              name={`${sourceIcons[key]}-outline` as any}
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
                    const isSelected = selectedSource === category.name;
                    return (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => handleSourceSelect(category.name)}
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
                                  setEditingCategory(category);
                                  setShowFilterMenu(false);
                                  setShowAddCategoryModal(true);
                                }}
                                style={styles.editCategoryButton}
                              >
                                <Ionicons name="create" size={18} color={theme.colors.textInverse} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  alertService.confirm(
                                    'حذف المصدر',
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
                                  setEditingCategory(category);
                                  setShowFilterMenu(false);
                                  setShowAddCategoryModal(true);
                                }}
                                style={styles.editCategoryButtonDefault}
                              >
                                <Ionicons name="create-outline" size={18} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  alertService.confirm(
                                    'حذف المصدر',
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
                      setEditingCategory(null);
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
                      <Text style={styles.addCategoryButtonText}>إضافة مصدر جديد</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      </View>

      <FlatList
        data={filteredIncome}
        ListHeaderComponent={() => {
          const totalAmount = filteredIncome.reduce((sum, income) => sum + income.amount, 0);
          return (
            <View style={styles.summaryCardContainer}>
              <LinearGradient
                colors={['#10B981', '#059669', '#047857'] as any}
                style={styles.summaryCard}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.summaryCardContent}>
                  <View style={styles.summaryCardHeader}>
                    <Ionicons name="trending-up" size={24} color={theme.colors.textInverse} />
                    <Text style={styles.summaryCardTitle}>إجمالي الدخل</Text>
                  </View>
                  <Text style={styles.summaryCardAmount}>
                    {formatCurrency(totalAmount)}
                  </Text>
                  <Text style={styles.summaryCardCount}>
                    {filteredIncome.length} {filteredIncome.length === 1 ? 'دخل' : 'دخل'}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <TransactionItem
            item={item}
            type="income"
            formatCurrency={formatCurrency}
            onEdit={() => {
              setEditingIncome(item);
              setShowAddModal(true);
            }}
            onDelete={async () => {
              try {
                await deleteIncome(item.id);
                await loadIncome();
                alertService.success('نجح', 'تم حذف الدخل بنجاح');
              } catch (error) {
                alertService.error('خطأ', 'حدث خطأ أثناء حذف الدخل');
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
            <View style={styles.emptyIconContainer} />
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

      <AddIncomeModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingIncome(null);
        }}
        income={editingIncome}
        onSave={loadIncome}
      />

      <AddCategoryModal
        visible={showAddCategoryModal}
        onClose={() => {
          setShowAddCategoryModal(false);
          setEditingCategory(null);
        }}
        onSave={handleAddCategory}
        type="income"
        category={editingCategory}
      />

      {/* Manage Categories Modal */}
      <Modal
        visible={showManageCategoriesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManageCategoriesModal(false)}
      >
        <Pressable
          style={styles.manageCategoriesOverlay}
          onPress={() => setShowManageCategoriesModal(false)}
        >
          <Pressable
            style={styles.manageCategoriesContainer}
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
              style={styles.manageCategoriesGradient}
            >
              <View style={styles.manageCategoriesHeader}>
                <Text style={styles.manageCategoriesTitle}>إدارة مصادر الدخل</Text>
                <TouchableOpacity
                  onPress={() => setShowManageCategoriesModal(false)}
                  style={styles.manageCategoriesCloseButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.manageCategoriesScrollContainer}>
                <ScrollView
                  style={styles.manageCategoriesScroll}
                  contentContainerStyle={styles.manageCategoriesContent}
                  showsVerticalScrollIndicator={true}
                >
                {/* All Categories Section */}
                <View style={styles.categoriesSection}>
                  <Text style={styles.categoriesSectionTitle}>جميع المصادر</Text>
                  {allCategories.length === 0 ? (
                    <View style={styles.emptyCategoriesContainer}>
                      <Ionicons name="folder-outline" size={64} color={theme.colors.textMuted} />
                      <Text style={styles.emptyCategoriesText}>لا توجد مصادر</Text>
                      <Text style={styles.emptyCategoriesSubtext}>
                        أضف مصادر دخل جديدة لتسهيل تصنيف دخلك
                      </Text>
                    </View>
                  ) : (
                    allCategories.map((category) => {
                      const defaultNames = Object.values(INCOME_SOURCES);
                      const isDefault = defaultNames.includes(category.name);
                      return (
                        <View key={category.id} style={styles.categoryManageItem}>
                          <View style={styles.categoryManageItemLeft}>
                            <View
                              style={[
                                styles.categoryManageIconContainer,
                                { backgroundColor: category.color + '20' },
                              ]}
                            >
                              <Ionicons
                                name={category.icon as any}
                                size={24}
                                color={category.color}
                              />
                            </View>
                            <View style={styles.categoryManageInfo}>
                              <Text style={styles.categoryManageName}>{category.name}</Text>
                              <Text style={styles.categoryManageType}>
                                {isDefault ? 'مصدر افتراضي' : 'مصدر مخصص'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.categoryManageActions}>
                            <TouchableOpacity
                              onPress={() => {
                                setEditingCategory(category);
                                setShowManageCategoriesModal(false);
                                setShowAddCategoryModal(true);
                              }}
                              style={styles.categoryManageEditButton}
                            >
                              <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                            </TouchableOpacity>
                            {!isDefault && (
                              <TouchableOpacity
                                onPress={() => {
                                  alertService.confirm(
                                    'حذف المصدر',
                                    `هل تريد حذف "${category.name}"؟`,
                                    () => handleDeleteCategory(category.id)
                                  );
                                }}
                                style={styles.categoryManageDeleteButton}
                              >
                                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
                </ScrollView>
              </View>

              <View style={styles.manageCategoriesFooter}>
                <TouchableOpacity
                  onPress={() => {
                    setShowManageCategoriesModal(false);
                    setEditingCategory(null);
                    setShowAddCategoryModal(true);
                  }}
                  style={styles.manageCategoriesAddButton}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669'] as any}
                    style={styles.manageCategoriesAddGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="add-circle" size={20} color={theme.colors.textInverse} />
                    <Text style={styles.manageCategoriesAddText}>إضافة مصدر جديد</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
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
    direction: 'rtl' as const,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    flex: 1,
  },
  monthFilterContainer: {
    alignItems: 'flex-start',
  },
  headerManageCategoriesButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  headerManageCategoriesGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  summaryCardContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  summaryCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
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
    fontWeight: '600',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  summaryCardAmount: {
    fontSize: 32,
    fontWeight: '800',
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
    fontWeight: '600',
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
    // direction: 'ltr',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    direction: 'ltr',
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
    fontWeight: '600',
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
    flexShrink: 0,
  },
  manageCategoriesAddButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  manageCategoriesAddGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  manageCategoriesAddText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
  categoriesSection: {
    marginBottom: theme.spacing.xl,
    textAlign: 'right',
  },
  categoriesSectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    textAlign: 'right',
  },
});
