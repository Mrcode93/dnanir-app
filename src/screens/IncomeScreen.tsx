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
import { getIncome, deleteIncome, getCustomCategories, addCustomCategory, deleteCustomCategory, updateCustomCategory, CustomCategory } from '../database/database';
import { Income, IncomeSource, INCOME_SOURCES } from '../types';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';
import { MonthFilter } from '../components/MonthFilter';
import { getMonthRange } from '../utils/date';
import { SmartAddModal } from '../components/SmartAddModal';

export const IncomeScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const [income, setIncome] = useState<Income[]>([]);
  const [filteredIncome, setFilteredIncome] = useState<Income[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<IncomeSource | 'all'>('all');
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

  const loadIncome = useCallback(async () => {
    try {
      let incomeData = await getIncome();

      // Get available months (months that have income)
      const monthsSet = new Set<string>();
      incomeData.forEach(income => {
        const [year, month] = income.date.split('-');
        if (year && month) {
          monthsSet.add(`${year}-${parseInt(month)}`);
        }
      });

      const months = Array.from(monthsSet).map(key => {
        const [year, month] = key.split('-').map(Number);
        return { year, month };
      });
      setAvailableMonths(months);

      // Filter by selected month if a month is selected
      if (selectedMonth && (selectedMonth.year !== 0 || selectedMonth.month !== 0)) {
        const { firstDay, lastDay } = getMonthRange(selectedMonth.year, selectedMonth.month);

        incomeData = incomeData.filter(
          (income) => income.date >= firstDay && income.date <= lastDay
        );
      }

      setIncome(incomeData);
      setFilteredIncome(incomeData);
    } catch (error) {
      // Ignore error
    }
  }, [selectedMonth]);

  const loadCustomCategories = useCallback(async () => {
    try {
      const categories = await getCustomCategories('income');
      setCustomCategories(categories);
    } catch (error) {
      // Ignore error
    }
  }, []);

  useEffect(() => {
    loadIncome();
    loadCustomCategories();
    const unsubscribe = navigation.addListener('focus', () => {
      loadIncome();
      loadCustomCategories();
    });
    return unsubscribe;
  }, [navigation, selectedMonth, loadIncome, loadCustomCategories]);

  useEffect(() => {
    if (route?.params?.income) {
      navigation.navigate('AddIncome', { income: route.params.income });
      navigation.setParams({ income: undefined });
    }
  }, [route?.params, navigation]);

  useEffect(() => {
    let filtered = income;

    if (searchQuery) {
      filtered = filtered.filter(incomeItem =>
        incomeItem.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incomeItem.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedSource !== 'all') {
      filtered = filtered.filter(incomeItem => {
        const sourceToCheck = incomeItem.category || incomeItem.source;
        if (!sourceToCheck) return false;

        // 1. Exact match (e.g. "راتب" === "راتب")
        if (sourceToCheck === selectedSource) return true;

        // 2. Map English Key to Arabic Name (e.g. "salary" maps to "راتب")
        // If the item has "salary" and selectedSource is "راتب"
        if (INCOME_SOURCES[sourceToCheck as IncomeSource] === selectedSource) return true;

        // 3. Map Arabic Name to English Key (Reverse check)
        // If the item has "راتب" and selectedSource is "salary" (Unlikely if chips are from DB names)
        const englishKey = Object.keys(INCOME_SOURCES).find(
          key => INCOME_SOURCES[key as IncomeSource] === sourceToCheck
        );
        if (englishKey === selectedSource) return true;

        // 4. Case-insensitive check for English <-> English or custom
        if (sourceToCheck.toLowerCase() === selectedSource.toLowerCase()) return true;

        return false;
      });
    }

    setFilteredIncome(filtered);
  }, [income, searchQuery, selectedSource, customCategories]);

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
      navigation.navigate('AddIncome');
    } else {
      setShowSmartAdd(true);
    }
  };

  const handleSourceSelect = (source: IncomeSource | 'all') => {
    setSelectedSource(source);
    setShowFilterMenu(false);
  };

  const totalAmount = useMemo(
    () => filteredIncome.reduce((sum, income) => sum + (income.base_amount ?? income.amount), 0),
    [filteredIncome]
  );

  const renderListHeader = useCallback(() => (
    <View style={styles.summaryContainer}>
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.summaryContent}>
          <View style={styles.summaryIconContainer}>
            <Ionicons name="trending-up" size={24} color="#FFF" />
          </View>
          <View style={styles.summaryTextContainer}>
            <Text style={styles.summaryLabel}>إجمالي الدخل</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>
        <View style={styles.summaryFooter}>
          <Text style={styles.summaryCount}>
            {filteredIncome.length} عملية دخل
          </Text>
        </View>
      </LinearGradient>
    </View>
  ), [filteredIncome.length, formatCurrency, styles, totalAmount]);

  const renderIncomeItem = useCallback(({ item }: { item: Income }) => (
    <TransactionItem
      item={item}
      type="income"
      formatCurrency={formatCurrency}
      customCategories={customCategories}
      onEdit={() => navigation.navigate('AddIncome', { income: item })}
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
  ), [customCategories, formatCurrency, loadIncome, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList
        data={filteredIncome}
        ListHeaderComponent={
          <>
            {/* Header Section */}
            <View style={styles.header}>
              <View style={styles.searchFilterRow}>
                <Searchbar
                  placeholder="البحث في الدخل..."
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
                    onPress={() => handleSourceSelect('all')}
                    style={[
                      styles.categoryChip,
                      selectedSource === 'all' && styles.categoryChipActive
                    ]}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      selectedSource === 'all' && styles.categoryChipTextActive
                    ]}>الكل</Text>
                  </TouchableOpacity>

                  {customCategories.map((category) => {
                    const isSelected = selectedSource === category.name;
                    return (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => handleSourceSelect(category.name as IncomeSource)}
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
        renderItem={renderIncomeItem}
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
              <Ionicons name="wallet-outline" size={64} color={theme.colors.primary + '40'} />
            </View>
            <Text style={styles.emptyText}>لا يوجد دخل مسجل</Text>
            <Text style={styles.emptySubtext}>اضغط على + لإضافة دخلك الأول لهذا الشهر</Text>
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
            <Text style={styles.addModalTitle}>إضافة دخل جديد</Text>

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
          loadIncome();
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
    gap: 8,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    elevation: 0,
    height: 40,
  },
  searchInput: {
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    fontSize: 13,
    height: 40,
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
