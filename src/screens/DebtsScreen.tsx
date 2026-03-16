import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import {
  getDebts,
  deleteDebt,
  getDebtInstallments,
  Debt,
  DebtInstallment,
} from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { DebtItem } from '../components/DebtItem';
import { DEBT_TYPES } from '../types';
import { payDebt, payInstallment } from '../services/debtService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { PayDebtModal } from '../components/PayDebtModal';

export const DebtsScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [filteredDebts, setFilteredDebts] = useState<Debt[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'debt' | 'installment' | 'advance' | 'all'>('all');
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const [installmentsMap, setInstallmentsMap] = useState<Record<number, DebtInstallment[]>>({});
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [debtToPay, setDebtToPay] = useState<Debt | null>(null);
  const filterMenuAnim = useRef(new Animated.Value(0)).current;

  const loadDebts = useCallback(async () => {
    try {
      const allDebts = await getDebts();
      setDebts(allDebts);

      // Load all installments in parallel instead of serially
      const installmentArrays = await Promise.all(
        allDebts.map(debt => getDebtInstallments(debt.id))
      );
      const installments: Record<number, DebtInstallment[]> = {};
      allDebts.forEach((debt, i) => {
        installments[debt.id] = installmentArrays[i];
      });
      setInstallmentsMap(installments);
    } catch (error) {

    }
  }, []);

  useEffect(() => {
    loadDebts();
    const unsubscribe = navigation.addListener('focus', () => {
      loadDebts();
    });
    return unsubscribe;
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
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16 }}>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={() => navigation.navigate('AddDebt')}
          >
            <Ionicons name="add-circle" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    if (route?.params?.action === 'add') {
      navigation.navigate('AddDebt');
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
        alertService.toastSuccess('تم حذف الدين بنجاح');
      } catch (error) {

        alertService.error('خطأ', 'حدث خطأ أثناء حذف الدين');
      }
    }
  };

  const handleDebtPress = (debt: Debt) => {
    navigation.navigate('DebtDetails', { debtId: debt.id });
  };

  const handleEdit = (debt: Debt) => {
    if (debt.isPaid) {
      alertService.show({
        title: 'تنبيه',
        message: 'لا يمكن تعديل الدين بعد سداده بالكامل.',
        type: 'info',
      });
      return;
    }
    navigation.navigate('AddDebt', { debt });
  };


  const handlePayDebt = (debt: Debt) => {
    setDebtToPay(debt);
    setShowPayModal(true);
  };

  const handlePayDebtConfirm = async (amount: number) => {
    if (!debtToPay) return;
    try {
      await payDebt(debtToPay.id, amount);
      await loadDebts();
      const isOwedToMe = debtToPay.direction === 'owed_to_me';
      const message = isOwedToMe
        ? (amount === debtToPay.remainingAmount ? 'تم تسجيل التسديد بالكامل وتمت إضافته لرصيدك' : `تم تسجيل تسديد ${formatCurrency(amount)} وتمت إضافته لرصيدك`)
        : (amount === debtToPay.remainingAmount ? 'تم دفع الدين بالكامل بنجاح' : `تم دفع ${formatCurrency(amount)} بنجاح`);
      alertService.toastSuccess(message);
      setShowPayModal(false);
      setDebtToPay(null);
    } catch (error) {

      alertService.error('خطأ', debtToPay.direction === 'owed_to_me' ? 'حدث خطأ أثناء تسجيل التسديد' : 'حدث خطأ أثناء دفع الدين');
      throw error;
    }
  };

  const handlePayInstallment = async (installment: DebtInstallment) => {
    try {
      await payInstallment(installment.id);
      await loadDebts();
      alertService.toastSuccess('تم دفع القسط بنجاح');
    } catch (error) {

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
    return new Date(dateStr).toLocaleDateString('ar-IQ-u-nu-latn');
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

  const { totalDebts, activeDebts, paidDebts } = useMemo(() => {
    let total = 0;
    let active = 0;
    let paid = 0;
    for (const d of debts) {
      if (d.isPaid) {
        paid++;
      } else {
        total += d.remainingAmount;
        active++;
      }
    }
    return { totalDebts: total, activeDebts: active, paidDebts: paid };
  }, [debts]);

  const renderListHeader = () => (
    <View style={styles.summaryContainer}>
      <LinearGradient
        colors={theme.gradients.info as any}
        style={styles.summaryCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.summaryTop}>
          <View style={styles.summaryIconBox}>
            <Ionicons name="card" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.summaryCardTitle}>ملخص الالتزامات</Text>
        </View>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryValue}>{formatCurrency(totalDebts)}</Text>
          <Text style={styles.summaryLabel}>إجمالي الديون النشطة</Text>
        </View>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{activeDebts}</Text>
            <Text style={styles.statLabel}>نشطة</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{paidDebts}</Text>
            <Text style={styles.statLabel}>مدفوعة</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderDebt = useCallback(({ item }: { item: Debt }) => {
    const installments = installmentsMap[item.id] || [];
    const unpaidInstallments = installments.filter(inst => !inst.isPaid);

    return (
      <View style={styles.itemWrapper}>
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
      </View>
    );
  }, [theme, styles, formatCurrency, installmentsMap, handleDebtPress, handleEdit, handleDelete, handlePayDebt]);

  return (
    <View style={styles.container}>
      {/* <View style={styles.headerFilterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {(['all', 'debt', 'installment', 'advance'] as const).map((type) => {
            const isSelected = selectedType === type;
            return (
              <TouchableOpacity
                key={type}
                onPress={() => handleTypeSelect(type)}
                style={[
                  styles.filterChip,
                  isSelected && styles.filterChipActive
                ]}
              >
                <Text style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextActive
                ]}>
                  {type === 'all' ? 'الكل' : getDebtTypeName(type)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View> */}

      <FlashList
        data={filteredDebts}
        // @ts-ignore
        estimatedItemSize={150}
        ListHeaderComponent={renderListHeader()}
        renderItem={renderDebt}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="card-outline" size={64} color={theme.colors.primary + '40'} />
            </View>
            <Text style={styles.emptyText}>
              {selectedType !== 'all' ? 'لا توجد نتائج' : 'لا توجد ديون مسجلة'}
            </Text>
            <Text style={styles.emptySubtext}>
              {selectedType !== 'all'
                ? 'جرب تغيير الفلتر للحصول على نتائج'
                : 'أضف أول دين أو قسط أو سلفة لتتبعها هنا'}
            </Text>
          </View>
        }
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

      <PayDebtModal
        visible={showPayModal}
        debt={debtToPay}
        onClose={() => {
          setShowPayModal(false);
          setDebtToPay(null);
        }}
        onPay={handlePayDebtConfirm}
      />
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFilterSection: {
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '50',
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  summaryContainer: {
    padding: 20,
  },
  headerEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.primary + '15',
  },
  headerEditText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 20,
    ...getPlatformShadow('md'),
  },
  summaryTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  summaryMain: {
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: getPlatformFontWeight('900'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  summaryStats: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: theme.typography.fontFamily,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  listContent: {
    paddingBottom: 100,
  },
  itemWrapper: {
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
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
  addModalOptions: {
    padding: 20,
    gap: 16,
  },
  addModalOption: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...getPlatformShadow('xs'),
  },
  addModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 16 : 0,
    marginRight: isRTL ? 0 : 16,
  },
  addModalOptionTextContainer: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  addModalOptionTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  addModalOptionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});

