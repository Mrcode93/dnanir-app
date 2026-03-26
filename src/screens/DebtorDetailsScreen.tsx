import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, Text, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { getDebts, getDebtInstallments, Debt, DebtInstallment, DebtorSummary, getDebtor, updateDebtor, deleteDebtor } from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrencyAmount } from '../services/currencyService';
import { DebtItem } from '../components/DebtItem';
import { payDebt } from '../services/debtService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { PayDebtModal } from '../components/PayDebtModal';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { ScreenContainer, AppInput, AppButton } from '../design-system';
import { tl, useLocalization } from "../localization";
export const DebtorDetailsScreen = ({
  navigation,
  route
}: any) => {
  useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [debtor, setDebtor] = useState<DebtorSummary>(route.params?.debtor);
  const [personDebts, setPersonDebts] = useState<Debt[]>([]);
  const [installmentsMap, setInstallmentsMap] = useState<Record<number, DebtInstallment[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [debtToPay, setDebtToPay] = useState<Debt | null>(null);

  // Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete State
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const loadData = useCallback(async () => {
    if (!debtor) return;
    try {
      const freshDebtor = await getDebtor(debtor.id);
      if (freshDebtor) {
        setDebtor(freshDebtor as any);
      }
      const allDebts = await getDebts();
      const filtered = allDebts.filter(d => d.debtorId === debtor.id || !d.debtorId && d.debtorName === debtor.name);
      setPersonDebts(filtered);
      const installmentArrays = await Promise.all(filtered.map(debt => getDebtInstallments(debt.id)));
      const installments: Record<number, DebtInstallment[]> = {};
      filtered.forEach((debt, i) => {
        installments[debt.id] = installmentArrays[i];
      });
      setInstallmentsMap(installments);
    } catch (error) {}
  }, [debtor.id]); // Optimization: depend only on ID

  useEffect(() => {
    loadData();
    navigation.setOptions({
      headerRight: () => <TouchableOpacity onPress={() => {
        setEditedName(debtor.name);
        setEditedPhone(debtor.phone || '');
        setShowEditModal(true);
      }} style={{
        marginRight: isRTL ? 0 : 16,
        marginLeft: isRTL ? 16 : 0,
        padding: 8
      }}>
          <Ionicons name="create-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
    });
  }, [loadData, navigation, debtor.name, debtor.phone]);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
  const handleUpdateDebtor = async () => {
    if (!editedName.trim()) {
      alertService.error(tl("تنبيه"), tl("يرجى إدخال الاسم"));
      return;
    }
    setIsUpdating(true);
    try {
      await updateDebtor(debtor.id, {
        name: editedName.trim(),
        phone: editedPhone.trim() || undefined
      });
      alertService.toastSuccess(tl("تم تحديث البيانات بنجاح"));
      setShowEditModal(false);
      loadData();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("فشل تحديث البيانات"));
    } finally {
      setIsUpdating(false);
    }
  };
  const handleDeleteDebtor = async () => {
    try {
      await deleteDebtor(debtor.id);
      alertService.toastSuccess(tl("تم حذف الحساب بنجاح"));
      setShowDeleteAlert(false);
      navigation.goBack();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("فشل حذف الحساب"));
    }
  };
  const handleDebtPress = (debt: Debt) => {
    navigation.navigate('DebtDetails', {
      debtId: debt.id
    });
  };
  const handleEditDebt = (debt: Debt) => {
    navigation.navigate('AddDebt', {
      debt
    });
  };
  const handlePayDebt = (debt: Debt) => {
    setDebtToPay(debt);
    setShowPayModal(true);
  };
  const handlePayDebtConfirm = async (amount: number) => {
    if (!debtToPay) return;
    try {
      await payDebt(debtToPay.id, amount);
      await loadData();
      alertService.toastSuccess(tl("تم تسجيل عملية التسديد"));
      setShowPayModal(false);
      setDebtToPay(null);
    } catch (error) {
      alertService.error(tl("خطأ"), tl("فشل في تسجيل التسديد"));
    }
  };
  const totalsByCurrency = useMemo(() => {
    const groups: Record<string, { toMe: number; byMe: number; net: number }> = {};
    personDebts.forEach(d => {
      if (d.isPaid) return;
      const cur = d.currency || 'IQD';
      if (!groups[cur]) {
        groups[cur] = { toMe: 0, byMe: 0, net: 0 };
      }
      if (d.direction === 'owed_to_me') groups[cur].toMe += d.remainingAmount;
      else groups[cur].byMe += d.remainingAmount;
    });
    
    Object.keys(groups).forEach(cur => {
      groups[cur].net = groups[cur].toMe - groups[cur].byMe;
    });
    
    return groups;
  }, [personDebts]);
  const renderHeader = () => {
    const currencies = Object.keys(totalsByCurrency);
    // Determine overall background color by checking if any currency has a positive net (owed to me)
    const isNetPositive = currencies.length > 0 ? currencies.some(cur => totalsByCurrency[cur].net >= 0) : true;
    const colors = isNetPositive ? theme.gradients.success : theme.gradients.info;
    return <View style={styles.headerCardContainer}>
        <LinearGradient colors={colors as any} style={styles.summaryCard} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }}>
          <View style={styles.summaryTopRow}>
            <View style={styles.typeBadge}>
              <View style={styles.avatarMini}>
                 <Text style={styles.avatarMiniText}>{debtor.name.charAt(0)}</Text>
              </View>
              <Text style={styles.typeBadgeText}>{tl("كشف حساب")}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowDeleteAlert(true)} style={styles.deleteIconBtn}>
              <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <View style={styles.amountContent}>
            <Text style={styles.amountLabelPrimary}>{tl("صافي الرصيد المتبقي لـ:")}</Text>
            <Text style={styles.debtorNameText}>{debtor.name}</Text>
            <View style={{ gap: 8, alignItems: 'center' }}>
              {currencies.length > 0 ? (
                 currencies.map(cur => {
                   const { net } = totalsByCurrency[cur];
                   return (
                     <Text key={cur} style={styles.totalAmountText}>
                       {net > 0 ? '+' : net < 0 ? '-' : ''}{formatCurrencyAmount(Math.abs(net), cur)}
                     </Text>
                   );
                 })
              ) : (
                <Text style={styles.totalAmountText}>{formatCurrencyAmount(0, 'IQD')}</Text>
              )}
            </View>
            {debtor.phone && <Text style={styles.debtorPhoneText}>{debtor.phone}</Text>}
          </View>

          <View style={{ gap: 16 }}>
            {currencies.length > 0 ? currencies.map(cur => (
              <View key={cur} style={styles.summaryFooter}>
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatLabel}>{tl("يستحق لك (لي)")}</Text>
                  <Text style={styles.footerStatValue}>{formatCurrencyAmount(totalsByCurrency[cur].toMe, cur)}</Text>
                </View>
                <View style={styles.footerDivider} />
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatLabel}>{tl("يستحق عليك (لي)")}</Text>
                  <Text style={styles.footerStatValue}>{formatCurrencyAmount(totalsByCurrency[cur].byMe, cur)}</Text>
                </View>
              </View>
            )) : (
              <View style={styles.summaryFooter}>
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatLabel}>{tl("يستحق لك (لي)")}</Text>
                  <Text style={styles.footerStatValue}>{formatCurrencyAmount(0, 'IQD')}</Text>
                </View>
                <View style={styles.footerDivider} />
                <View style={styles.footerStat}>
                  <Text style={styles.footerStatLabel}>{tl("يستحق عليك (لي)")}</Text>
                  <Text style={styles.footerStatValue}>{formatCurrencyAmount(0, 'IQD')}</Text>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>;
  };
  return <ScreenContainer edges={['left', 'right', 'bottom']}>
      <FlashList data={personDebts as any[]}
    // @ts-ignore
    estimatedItemSize={120} ListHeaderComponent={renderHeader()} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} renderItem={({
      item
    }) => <View style={styles.itemWrapper}>
            <DebtItem item={item as Debt} onPress={() => handleDebtPress(item)} onEdit={() => handleEditDebt(item)} onDelete={() => {/* handle delete if needed */}} onPay={() => handlePayDebt(item)} formatCurrency={(amt) => formatCurrencyAmount(amt, item.currency || 'IQD')} unpaidInstallmentsCount={(installmentsMap[item.id] || []).filter(i => !i.isPaid).length} totalInstallmentsCount={(installmentsMap[item.id] || []).length} />
          </View>} ListEmptyComponent={<View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>{tl("لا توجد عمليات لهذا الشخص")}</Text>
          </View>} />

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{tl("تعديل البيانات")}</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>{tl("الاسم")}</Text>
                    <AppInput placeholder={tl("أدخل الاسم...")} value={editedName} onChangeText={text => setEditedName(text)} icon="person-outline" autoFocus />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>{tl("رقم الهاتف (اختياري)")}</Text>
                    <AppInput placeholder="07xxxxxxxx" value={editedPhone} onChangeText={text => setEditedPhone(text)} keyboardType="phone-pad" icon="call-outline" />
                  </View>
                </View>

                <View style={styles.modalFooter}>
                  <AppButton label={tl("حفظ التغييرات")} onPress={handleUpdateDebtor} loading={isUpdating} variant="primary" size="lg" style={{
                  width: '100%'
                }} />
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <PayDebtModal visible={showPayModal} debt={debtToPay} onClose={() => setShowPayModal(false)} onPay={handlePayDebtConfirm} />

      <ConfirmAlert visible={showDeleteAlert} onCancel={() => setShowDeleteAlert(false)} onConfirm={handleDeleteDebtor} title={tl("حذف الحساب")} message={tl("هل أنت متأكد من حذف هذا الحساب؟ لن يتم حذف الديون المرتبطة به ولكن سيتم فك ارتباطها بهذا الاسم.")} confirmText={tl("حذف")} cancelText={tl("إلغاء")} type="danger" />
    </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  listContent: {
    paddingBottom: 40
  },
  headerCardContainer: {
    padding: 20
  },
  summaryCard: {
    borderRadius: 32,
    padding: 24,
    minHeight: 240,
    justifyContent: 'space-between',
    ...getPlatformShadow('lg')
  },
  summaryTopRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  typeBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  avatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarMiniText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  },
  deleteIconBtn: {
    padding: 4
  },
  amountContent: {
    alignItems: 'center',
    marginVertical: 12
  },
  amountLabelPrimary: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4
  },
  debtorNameText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: getPlatformFontWeight('800'),
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4
  },
  totalAmountText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: getPlatformFontWeight('900'),
    fontFamily: theme.typography.fontFamily
  },
  debtorPhoneText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4
  },
  summaryFooter: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
    gap: 16
  },
  footerStat: {
    flex: 1,
    alignItems: 'center'
  },
  footerStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2
  },
  footerStatValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  },
  footerDivider: {
    width: 1,
    height: '60%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center'
  },
  itemWrapper: {
    paddingHorizontal: 20
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    gap: 12
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontSize: 14
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  keyboardView: {
    width: '100%'
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    ...getPlatformShadow('lg')
  },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  closeBtn: {
    padding: 4
  },
  modalBody: {
    gap: 20,
    marginBottom: 32
  },
  inputGroup: {
    gap: 8
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    paddingHorizontal: 4
  },
  modalFooter: {
    width: '100%'
  }
});
