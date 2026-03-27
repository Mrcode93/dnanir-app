import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, Text, TouchableOpacity, Animated } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { getDebts, deleteDebt, getDebtInstallments, Debt, DebtInstallment, getDebtorSummaries, DebtorSummary, addDebtor } from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { DebtItem } from '../components/DebtItem';
import { DEBT_TYPES } from '../types';
import { payDebt, payInstallment } from '../services/debtService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { PayDebtModal } from '../components/PayDebtModal';
import { formatCurrencyAmount } from '../services/currencyService';
import { tl, useLocalization } from "../localization";
import { AppBottomSheet, AppButton } from '../design-system';
import { TextInput } from 'react-native-paper';
export const DebtsScreen = ({
  navigation,
  route
}: any) => {
  const {
    language
  } = useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    formatCurrency
  } = useCurrency();
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
  const [viewMode, setViewMode] = useState<'debts' | 'debtors'>('debtors');
  const [debtorSummaries, setDebtorSummaries] = useState<DebtorSummary[]>([]);
  const [showAddDebtorModal, setShowAddDebtorModal] = useState(false);
  const [newDebtorName, setNewDebtorName] = useState('');
  const [newDebtorPhone, setNewDebtorPhone] = useState('');
  const filterMenuAnim = useRef(new Animated.Value(0)).current;
  const loadDebts = useCallback(async () => {
    try {
      const allDebts = await getDebts();
      setDebts(allDebts);
      const summaries = await getDebtorSummaries();
      setDebtorSummaries(summaries);

      // Load all installments in parallel instead of serially
      const installmentArrays = await Promise.all(allDebts.map(debt => getDebtInstallments(debt.id)));
      const installments: Record<number, DebtInstallment[]> = {};
      allDebts.forEach((debt, i) => {
        installments[debt.id] = installmentArrays[i];
      });
      setInstallmentsMap(installments);
    } catch (error) {}
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
      filtered = filtered.filter(debt => debt.debtorName.toLowerCase().includes(searchQuery.toLowerCase()) || debt.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (selectedType !== 'all') {
      filtered = filtered.filter(debt => debt.type === selectedType);
    }
    setFilteredDebts(filtered);
  }, [debts, searchQuery, selectedType]);
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => <TouchableOpacity onPress={() => navigation.goBack()} style={{
        paddingHorizontal: 16
      }}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>,
      headerRight: () => <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 16
      }}>
          {viewMode === 'debtors' && (
            <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowAddDebtorModal(true)}>
              <Ionicons name="person-add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={{
          padding: 8
        }} onPress={() => navigation.navigate('AddDebt')}>
            <Ionicons name="add-circle" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
    });
  }, [navigation, viewMode]);
  useEffect(() => {
    if (route?.params?.action === 'add') {
      navigation.navigate('AddDebt');
      navigation.setParams({
        action: undefined
      });
    }
  }, [route?.params]);
  useEffect(() => {
    if (showFilterMenu) {
      Animated.spring(filterMenuAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7
      }).start();
    } else {
      Animated.timing(filterMenuAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
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
        alertService.toastSuccess(tl("تم حذف الدين بنجاح"));
      } catch (error) {
        alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حذف الدين"));
      }
    }
  };
  const handleDebtPress = (debt: Debt) => {
    navigation.navigate('DebtDetails', {
      debtId: debt.id
    });
  };
  const handleEdit = (debt: Debt) => {
    if (debt.isPaid) {
      alertService.show({
        title: tl("تنبيه"),
        message: tl("لا يمكن تعديل الدين بعد سداده بالكامل."),
        type: 'info'
      });
      return;
    }
    navigation.navigate('AddDebt', {
      debt
    });
  };
  const handlePayDebt = (debt: Debt) => {
    setDebtToPay(debt);
    setShowPayModal(true);
  };
  const handlePayDebtConfirm = async (amount: number, walletId?: number) => {
    if (!debtToPay) return;
    try {
      await payDebt(debtToPay.id, amount, walletId);
      await loadDebts();
      const isOwedToMe = debtToPay.direction === 'owed_to_me';
      const message = isOwedToMe ? amount === debtToPay.remainingAmount ? tl("تم تسجيل التسديد بالكامل وتمت إضافته لرصيدك") : tl("تم تسجيل تسديد {{}} وتمت إضافته لرصيدك", [formatCurrencyAmount(amount, debtToPay.currency || 'IQD')]) : amount === debtToPay.remainingAmount ? tl("تم دفع الدين بالكامل بنجاح") : tl("تم دفع {{}} بنجاح", [formatCurrencyAmount(amount, debtToPay.currency || 'IQD')]);
      alertService.toastSuccess(message);
      setShowPayModal(false);
      setDebtToPay(null);
    } catch (error) {
      alertService.error(tl("خطأ"), debtToPay.direction === 'owed_to_me' ? tl("حدث خطأ أثناء تسجيل التسديد") : tl("حدث خطأ أثناء دفع الدين"));
      throw error;
    }
  };
  const handlePayInstallment = async (installment: DebtInstallment) => {
    try {
      await payInstallment(installment.id);
      await loadDebts();
      alertService.toastSuccess(tl("تم دفع القسط بنجاح"));
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء دفع القسط"));
    }
  };
  const handleAddNewDebtor = async () => {
    if (!newDebtorName.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال اسم الشخص"));
      return;
    }
    try {
      await addDebtor({
        name: newDebtorName.trim(),
        phone: newDebtorPhone.trim() || undefined
      });
      await loadDebts();
      setShowAddDebtorModal(false);
      setNewDebtorName('');
      setNewDebtorPhone('');
      alertService.toastSuccess(tl("تم إضافة الشخص بنجاح"));
    } catch (e) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء إضافة الشخص"));
    }
  };
  const getDebtTypeName = (type: string) => {
    return DEBT_TYPES[type as keyof typeof DEBT_TYPES] || type;
  };
  const typeIcons: Record<'debt' | 'installment' | 'advance', string> = {
    debt: 'card',
    installment: 'calendar',
    advance: 'cash'
  };
  const typeColors: Record<'debt' | 'installment' | 'advance', string[]> = {
    debt: ['#8B5CF6', '#7C3AED'],
    installment: ['#3B82F6', '#2563EB'],
    advance: ['#F59E0B', '#D97706']
  };
  const handleTypeSelect = (type: 'debt' | 'installment' | 'advance' | 'all') => {
    setSelectedType(type);
    setShowFilterMenu(false);
  };
  const getSelectedTypeLabel = () => {
    if (selectedType === 'all') return tl("الكل");
    return getDebtTypeName(selectedType);
  };
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return tl("غير محدد");
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US');
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
  const {
    totalDebts,
    activeDebts,
    paidDebts
  } = useMemo(() => {
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
    return {
      totalDebts: total,
      activeDebts: active,
      paidDebts: paid
    };
  }, [debts]);
  const renderListHeader = () => <View style={styles.segmentedToggleContainer}>
      <View style={styles.segmentedToggle}>
        <TouchableOpacity style={[styles.toggleButton, viewMode === 'debts' && styles.toggleButtonActive]} onPress={() => setViewMode('debts')}>
          <Ionicons name="list" size={18} color={viewMode === 'debts' ? '#FFFFFF' : theme.colors.textMuted} />
          <Text style={[styles.toggleButtonText, viewMode === 'debts' && styles.toggleButtonTextActive]}>{tl("العمليات")}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.toggleButton, viewMode === 'debtors' && styles.toggleButtonActive]} onPress={() => setViewMode('debtors')}>
          <Ionicons name="people" size={18} color={viewMode === 'debtors' ? '#FFFFFF' : theme.colors.textMuted} />
          <Text style={[styles.toggleButtonText, viewMode === 'debtors' && styles.toggleButtonTextActive]}>{tl("الأشخاص")}</Text>
        </TouchableOpacity>
      </View>
    </View>;
  const renderDebtor = useCallback(({
    item
  }: {
    item: DebtorSummary;
  }) => {
    return <TouchableOpacity style={styles.debtorCard} onPress={() => navigation.navigate('DebtorDetails', {
      debtor: item
    })}>
        <View style={styles.debtorAvatar}>
          <Text style={styles.debtorAvatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.debtorInfo}>
          <Text style={styles.debtorName}>{item.name}</Text>
          <Text style={styles.debtorSummary}>
            {item.totalDebts} {tl("عمليات")}
          </Text>
        </View>
        <View style={styles.debtorBalance}>
          {item.balances && item.balances.length > 0 ? item.balances.map(b => (
            <View key={b.currency} style={{ alignItems: isRTL ? 'flex-start' : 'flex-end', marginBottom: 2 }}>
              <Text style={[styles.balanceValue, { color: b.netBalance >= 0 ? theme.colors.success : theme.colors.error }]}>
                {b.netBalance > 0 ? '+' : b.netBalance < 0 ? '-' : ''}{formatCurrencyAmount(Math.abs(b.netBalance), b.currency)}
              </Text>
            </View>
          )) : (
            <View style={{ alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
              <Text style={[styles.balanceValue, { color: theme.colors.success }]}>
                {formatCurrencyAmount(0, 'IQD')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>;
  }, [theme, styles, formatCurrency, navigation]);
  const renderDebt = useCallback(({
    item
  }: {
    item: Debt;
  }) => {
    const installments = installmentsMap[item.id] || [];
    const unpaidInstallments = installments.filter(inst => !inst.isPaid);
    return <View style={styles.itemWrapper}>
        <DebtItem item={item} onPress={() => handleDebtPress(item)} onEdit={() => handleEdit(item)} onDelete={() => handleDelete(item)} onPay={() => handlePayDebt(item)} formatCurrency={formatCurrency} unpaidInstallmentsCount={unpaidInstallments.length} totalInstallmentsCount={installments.length} />
      </View>;
  }, [theme, styles, formatCurrency, installmentsMap, handleDebtPress, handleEdit, handleDelete, handlePayDebt]);
  return <View style={styles.container}>
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

      <FlashList data={(viewMode === 'debtors' ? debtorSummaries : filteredDebts) as any[]}
    // @ts-ignore
    estimatedItemSize={100} ListHeaderComponent={renderListHeader()} renderItem={viewMode === 'debtors' ? renderDebtor : renderDebt as any} keyExtractor={item => item.id.toString()} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />} ListEmptyComponent={<View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name={viewMode === 'debtors' ? "people-outline" : "card-outline"} size={64} color={theme.colors.primary + '40'} />
            </View>
            <Text style={styles.emptyText}>
              {viewMode === 'debtors' ? tl("لا يوجد أشخاص") : selectedType !== 'all' ? tl("لا توجد نتائج") : tl("لا توجد ديون مسجلة")}
            </Text>
            <Text style={styles.emptySubtext}>
              {viewMode === 'debtors' ? tl("أضف ديناً جديداً لارتباطه بشخص ما") : selectedType !== 'all' ? tl("جرب تغيير الفلتر للحصول على نتائج") : tl("أضف أول دين أو قسط أو سلفة لتتبعها هنا")}
            </Text>
          </View>} />


      <ConfirmAlert visible={showDeleteAlert} onCancel={() => {
      setShowDeleteAlert(false);
      setDebtToDelete(null);
    }} onConfirm={() => {
      confirmDelete();
    }} title={tl("حذف الدين")} message={tl("هل أنت متأكد من حذف هذا الدين؟ سيتم حذف جميع الأقساط المرتبطة به.")} confirmText={tl("حذف")} cancelText={tl("إلغاء")} type="danger" />

      <PayDebtModal visible={showPayModal} debt={debtToPay} onClose={() => {
      setShowPayModal(false);
      setDebtToPay(null);
    }} onPay={handlePayDebtConfirm} />

      <AppBottomSheet visible={showAddDebtorModal} onClose={() => setShowAddDebtorModal(false)} title={tl("إضافة شخص جديد")}>
        <View style={styles.modalContent}>
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>{tl("الاسم")}</Text>
            <TextInput value={newDebtorName} onChangeText={setNewDebtorName} placeholder={tl("أدخل الاسم")} style={styles.modalInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} />
          </View>
          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>{tl("رقم الهاتف (اختياري)")}</Text>
            <TextInput value={newDebtorPhone} onChangeText={setNewDebtorPhone} placeholder="07xxxxxxxx" keyboardType="phone-pad" style={styles.modalInput} underlineColor="transparent" activeUnderlineColor="transparent" placeholderTextColor={theme.colors.textMuted} />
          </View>
          <AppButton label={tl("حفظ الشخص")} onPress={handleAddNewDebtor} variant="primary" style={{
            marginTop: 10
          }} />
        </View>
      </AppBottomSheet>
    </View>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerFilterSection: {
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '50'
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: isRTL ? 'row-reverse' : 'row'
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },
  segmentedToggleContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20
  },
  segmentedToggle: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 4,
    ...getPlatformShadow('sm')
  },
  toggleButton: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
    borderRadius: 12
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary
  },
  toggleButtonText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMuted
  },
  toggleButtonTextActive: {
    color: '#FFFFFF'
  },
  listContent: {
    paddingBottom: 100
  },
  itemWrapper: {
    paddingHorizontal: 20
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  emptyText: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 18,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  emptySubtext: {
    fontFamily: theme.typography.fontFamily,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: '70%'
  },
  addModalOptions: {
    padding: 20,
    gap: 16
  },
  addModalOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...getPlatformShadow('xs')
  },
  addModalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: isRTL ? 16 : 0,
    marginRight: isRTL ? 0 : 16
  },
  addModalOptionTextContainer: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  addModalOptionTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4
  },
  addModalOptionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  debtorCard: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 12,
    ...getPlatformShadow('xs')
  },
  debtorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center'
  },
  debtorAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary
  },
  debtorInfo: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  debtorName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  debtorSummary: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2
  },
  debtorBalance: {
    alignItems: isRTL ? 'flex-start' : 'flex-end'
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily
  },
  balanceLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2
  },
  modalContent: {
    paddingBottom: 20
  },
  modalField: {
    marginBottom: 16
  },
  modalLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
    textAlign: isRTL ? 'right' : 'left'
  },
  modalInput: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily
  }
});
