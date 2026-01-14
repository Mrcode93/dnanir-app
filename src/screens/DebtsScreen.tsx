import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { 
  getDebts, 
  deleteDebt,
  getDebtInstallments,
  Debt,
  DebtInstallment,
} from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { AddDebtModal } from '../components/AddDebtModal';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { DebtItem } from '../components/DebtItem';
import { DEBT_TYPES } from '../types';
import { payDebt, payInstallment } from '../services/debtService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';

export const DebtsScreen = ({ navigation, route }: any) => {
  const { formatCurrency } = useCurrency();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [filteredDebts, setFilteredDebts] = useState<Debt[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'debt' | 'installment' | 'advance' | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [installmentsMap, setInstallmentsMap] = useState<Record<number, DebtInstallment[]>>({});
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterMenuAnim = useRef(new Animated.Value(0)).current;

  const loadDebts = async () => {
    try {
      const allDebts = await getDebts();
      setDebts(allDebts);
      
      // Load installments for each debt
      const installments: Record<number, DebtInstallment[]> = {};
      for (const debt of allDebts) {
        const debtInstallments = await getDebtInstallments(debt.id);
        installments[debt.id] = debtInstallments;
      }
      setInstallmentsMap(installments);
    } catch (error) {
      console.error('Error loading debts:', error);
    }
  };

  useEffect(() => {
    loadDebts();
    const unsubscribe = navigation.addListener('focus', () => {
      loadDebts();
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
    let filtered = debts;

    if (searchQuery) {
      filtered = filtered.filter(debt =>
        debt.debtorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        debt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(debt => debt.type === selectedType);
    }

    setFilteredDebts(filtered);
  }, [debts, searchQuery, selectedType]);

  useEffect(() => {
    if (route?.params?.action === 'add') {
      handleAdd();
      navigation.setParams({ action: undefined });
    }
  }, [route?.params]);

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
    await loadDebts();
    setRefreshing(false);
  };

  const handleDelete = (debt: Debt) => {
    setDebtToDelete(debt);
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (debtToDelete) {
      try {
        await deleteDebt(debtToDelete.id);
        await loadDebts();
        setShowDeleteAlert(false);
        setDebtToDelete(null);
      } catch (error) {
        console.error('Error deleting debt:', error);
        alertService.error('خطأ', 'حدث خطأ أثناء حذف الدين');
      }
    }
  };

  const handleDebtPress = (debt: Debt) => {
    navigation.navigate('Debts', {
      screen: 'DebtDetails',
      params: { debtId: debt.id }
    });
  };

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setShowAddModal(true);
  };

  const handleAdd = () => {
    setEditingDebt(null);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingDebt(null);
    loadDebts();
  };

  const handlePayDebt = async (debt: Debt) => {
    try {
      await payDebt(debt.id);
      await loadDebts();
      alertService.success('نجح', 'تم دفع الدين بنجاح');
    } catch (error) {
      console.error('Error paying debt:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء دفع الدين');
    }
  };

  const handlePayInstallment = async (installment: DebtInstallment) => {
    try {
      await payInstallment(installment.id);
      await loadDebts();
      alertService.success('نجح', 'تم دفع القسط بنجاح');
    } catch (error) {
      console.error('Error paying installment:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء دفع القسط');
    }
  };

  const getDebtTypeName = (type: string) => {
    return DEBT_TYPES[type as keyof typeof DEBT_TYPES] || type;
  };

  const typeIcons: Record<'debt' | 'installment' | 'advance', string> = {
    debt: 'card',
    installment: 'calendar',
    advance: 'cash',
  };

  const typeColors: Record<'debt' | 'installment' | 'advance', string[]> = {
    debt: ['#8B5CF6', '#7C3AED'],
    installment: ['#3B82F6', '#2563EB'],
    advance: ['#F59E0B', '#D97706'],
  };

  const handleTypeSelect = (type: 'debt' | 'installment' | 'advance' | 'all') => {
    setSelectedType(type);
    setShowFilterMenu(false);
  };

  const getSelectedTypeLabel = () => {
    if (selectedType === 'all') return 'الكل';
    return getDebtTypeName(selectedType);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'غير محدد';
    return new Date(dateStr).toLocaleDateString('ar-IQ');
  };

  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const totalDebts = debts.filter(d => !d.isPaid).reduce((sum, d) => sum + d.remainingAmount, 0);
  const activeDebts = debts.filter(d => !d.isPaid).length;
  const paidDebts = debts.filter(d => d.isPaid).length;

  const renderDebt = ({ item }: { item: Debt }) => {
    const installments = installmentsMap[item.id] || [];
    const unpaidInstallments = installments.filter(inst => !inst.isPaid);
    
    return (
      <DebtItem
        item={item}
        onPress={() => handleDebtPress(item)}
        onEdit={() => handleEdit(item)}
        onDelete={() => handleDelete(item)}
        onPay={() => handlePayDebt(item)}
        formatCurrency={formatCurrency}
        unpaidInstallmentsCount={unpaidInstallments.length}
        totalInstallmentsCount={installments.length}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with Search and Filter */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="البحث في الديون المستحقة عليك..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        {/* Filter Buttons Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={styles.filterRowContent}
        >
          {(['all', 'debt', 'installment', 'advance'] as const).map((type) => {
            const isSelected = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                onPress={() => handleTypeSelect(type)}
                style={styles.filterButton}
                activeOpacity={0.7}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={type === 'all' 
                      ? (theme.gradients.primary as any)
                      : (typeColors[type] as any)}
                    style={styles.filterButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={type === 'all' 
                        ? 'apps' 
                        : (typeIcons[type] as any)}
                      size={16}
                      color={theme.colors.textInverse}
                    />
                    <Text style={styles.filterButtonTextActive}>
                      {type === 'all' ? 'الكل' : getDebtTypeName(type)}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.filterButtonDefault}>
                    <Ionicons
                      name={type === 'all' 
                        ? 'apps-outline' 
                        : (typeIcons[type] as any)}
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.filterButtonText}>
                      {type === 'all' ? 'الكل' : getDebtTypeName(type)}
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
            <Text style={styles.summaryLabel}>إجمالي الديون المستحقة</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalDebts)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>ديون نشطة</Text>
            <Text style={[styles.summaryAmount, { color: '#F59E0B' }]}>{activeDebts}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>ديون مدفوعة</Text>
            <Text style={[styles.summaryAmount, { color: '#10B981' }]}>{paidDebts}</Text>
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
                <Text style={styles.filterMenuTitle}>اختر نوع الدين</Text>
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
                  onPress={() => handleTypeSelect('all')}
                  style={[
                    styles.filterMenuItem,
                    selectedType === 'all' && styles.filterMenuItemActive,
                  ]}
                  activeOpacity={0.7}
                >
                  {selectedType === 'all' ? (
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
                {(['debt', 'installment', 'advance'] as const).map((type) => {
                  const isSelected = selectedType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => handleTypeSelect(type)}
                      style={[
                        styles.filterMenuItem,
                        isSelected && styles.filterMenuItemActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      {isSelected ? (
                        <LinearGradient
                          colors={typeColors[type] as any}
                          style={styles.filterMenuItemGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Ionicons
                            name={typeIcons[type] as any}
                            size={22}
                            color={theme.colors.textInverse}
                          />
                          <Text style={styles.filterMenuItemTextActive}>{getDebtTypeName(type)}</Text>
                          <Ionicons name="checkmark-circle" size={20} color={theme.colors.textInverse} />
                        </LinearGradient>
                      ) : (
                        <View style={styles.filterMenuItemDefault}>
                          <Ionicons
                            name={`${typeIcons[type]}-outline` as any}
                            size={22}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={styles.filterMenuItemText}>{getDebtTypeName(type)}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <FlatList
        data={filteredDebts}
        renderItem={renderDebt}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={80} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery || selectedType !== 'all' ? 'لا توجد نتائج' : 'لا توجد ديون مستحقة عليك'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery || selectedType !== 'all' 
                ? 'جرب البحث بكلمات مختلفة أو تغيير الفلتر'
                : 'أضف دين مستحق عليك أو قسط لتتبعه'}
            </Text>
          </View>
        }
      />

      <AddDebtModal
        visible={showAddModal}
        onClose={handleModalClose}
        editingDebt={editingDebt}
      />
      
      <ConfirmAlert
        visible={showDeleteAlert}
        onCancel={() => {
          setShowDeleteAlert(false);
          setDebtToDelete(null);
        }}
        onConfirm={() => {
          confirmDelete();
        }}
        title="حذف الدين"
        message="هل أنت متأكد من حذف هذا الدين؟ سيتم حذف جميع الأقساط المرتبطة به."
        confirmText="حذف"
        cancelText="إلغاء"
        type="danger"
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
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
  searchFilterRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  searchContainer: {
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    backgroundColor: theme.colors.surfaceLight,
    elevation: 0,
    borderRadius: theme.borderRadius.md,
  },
  searchInput: {
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
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
  summaryRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
    textAlign: 'center',
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
    direction: 'rtl',
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
    textAlign: 'right',
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterMenuItemDefault: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
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
});
