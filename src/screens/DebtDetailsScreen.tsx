import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { AppButton, ScreenContainer, AppHeader } from '../design-system';
import { getDebt, getDebtInstallments, deleteDebt, getDebtPayments, Debt, DebtInstallment, DebtPayment } from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { DEBT_TYPES } from '../types';
import { payDebt, payInstallment } from '../services/debtService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { PayDebtModal } from '../components/PayDebtModal';
import { tl, useLocalization } from "../localization";
export const DebtDetailsScreen = ({
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
  const [debt, setDebt] = useState<Debt | null>(null);
  const [installments, setInstallments] = useState<DebtInstallment[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const debtId = route.params?.debtId;
  const loadDebtData = async () => {
    if (!debtId) return;
    try {
      const debtData = await getDebt(debtId);
      if (debtData) {
        setDebt(debtData);
        const installmentsData = await getDebtInstallments(debtId);
        setInstallments(installmentsData.sort((a, b) => a.installmentNumber - b.installmentNumber));
        const paymentsData = await getDebtPayments(debtId);
        setPayments(paymentsData);
      }
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء تحميل بيانات الدين"));
    }
  };
  useEffect(() => {
    loadDebtData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadDebtData();
    });
    return unsubscribe;
  }, [navigation, debtId]);
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => <TouchableOpacity onPress={handleEdit} style={{
        marginRight: isRTL ? 0 : 16,
        marginLeft: isRTL ? 16 : 0,
        padding: 8
      }}>
          <Ionicons name="create-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
    });
  }, [navigation, debt, theme]);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDebtData();
    setRefreshing(false);
  };
  const handlePayDebt = () => {
    if (!debt) return;
    setShowPayModal(true);
  };
  const handlePayDebtConfirm = async (amount: number) => {
    if (!debt) return;
    try {
      await payDebt(debt.id, amount);
      await loadDebtData();
      const isOwedToMe = debt.direction === 'owed_to_me';
      const message = isOwedToMe ? amount === debt.remainingAmount ? tl("تم تسجيل التسديد بالكامل وتمت إضافته لرصيدك") : tl("تم تسجيل تسديد {{}} وتمت إضافته لرصيدك", [formatCurrency(amount)]) : amount === debt.remainingAmount ? tl("تم دفع الدين بالكامل بنجاح") : tl("تم دفع {{}} بنجاح", [formatCurrency(amount)]);
      alertService.toastSuccess(message);
      setShowPayModal(false);
    } catch (error) {
      alertService.error(tl("خطأ"), debt.direction === 'owed_to_me' ? tl("حدث خطأ أثناء تسجيل التسديد") : tl("حدث خطأ أثناء دفع الدين"));
      throw error;
    }
  };
  const handlePayInstallment = async (installment: DebtInstallment) => {
    if (!debt) return;
    try {
      await payInstallment(installment.id);
      await loadDebtData();
      const isOwedToMe = debt.direction === 'owed_to_me';
      alertService.toastSuccess(isOwedToMe ? tl("تم تسجيل تسديد القسط وإضافته لرصيدك") : tl("تم دفع القسط بنجاح"));
    } catch (error) {
      alertService.error(tl("خطأ"), debt.direction === 'owed_to_me' ? tl("حدث خطأ أثناء تسجيل تسديد القسط") : tl("حدث خطأ أثناء دفع القسط"));
    }
  };
  const handleEdit = () => {
    if (debt) {
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
    }
  };
  const handleDelete = () => {
    setShowDeleteAlert(true);
  };
  const confirmDelete = async () => {
    if (!debt) return;
    try {
      await deleteDebt(debt.id);
      setShowDeleteAlert(false);
      alertService.toastSuccess(tl("تم حذف الدين بنجاح"));
      navigation.goBack();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حذف الدين"));
    }
  };
  if (!debt) {
    return <ScreenContainer>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{tl("جاري التحميل...")}</Text>
        </View>
      </ScreenContainer>;
  }
  const typeIcons: Record<'debt' | 'installment' | 'advance', string> = {
    debt: 'card',
    installment: 'calendar',
    advance: 'cash'
  };
  const typeColors: Record<'debt' | 'installment' | 'advance', string[]> = {
    debt: theme.gradients.info,
    installment: theme.gradients.info,
    advance: [theme.colors.warning, theme.colors.warning]
  };

  // Use green colors for paid debts, original colors for unpaid
  const baseColors = typeColors[debt.type];
  const colors = debt.isPaid ? theme.gradients.success // Green gradient for paid debts
  : baseColors;
  const paidInstallments = installments.filter(inst => inst.isPaid);
  const unpaidInstallments = installments.filter(inst => !inst.isPaid);
  const progress = debt.totalAmount > 0 ? (debt.totalAmount - debt.remainingAmount) / debt.totalAmount * 100 : 0;
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return tl("غير محدد");
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
  return <ScreenContainer scrollable edges={['left', 'right', 'bottom']}>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
        {/* Premium Summary Card */}
        <LinearGradient colors={colors as any} style={styles.summaryCard} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }}>
          <View style={styles.summaryTopRow}>
            <View style={styles.typeBadge}>
              <Ionicons name={typeIcons[debt.type] as any} size={14} color="#FFFFFF" />
              <Text style={styles.typeBadgeText}>
                {debt.direction === 'owed_to_me' ? tl("يستحق لك") : tl("يستحق عليك")}
              </Text>
            </View>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteIconBtn}>
              <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <View style={styles.amountContent}>
            <Text style={styles.amountLabelPrimary}>
              {debt.direction === 'owed_to_me' ? tl("مبلغ يستحق لك من:") : tl("مبلغ تستحق دفعه لـ:")}
            </Text>
            <Text style={styles.debtorNameText}>{debt.debtorName}</Text>
            <Text style={styles.totalAmountText}>{formatCurrency(debt.totalAmount)}</Text>
          </View>

          <View style={styles.summaryFooter}>
            <View style={styles.footerStat}>
              <Text style={styles.footerStatLabel}>{tl("المتبقي")}</Text>
              <Text style={styles.footerStatValue}>{formatCurrency(debt.remainingAmount)}</Text>
            </View>
            <View style={styles.footerDivider} />
            <View style={styles.footerStat}>
              <Text style={styles.footerStatLabel}>{tl("الحالة")}</Text>
              <Text style={styles.footerStatValue}>{debt.isPaid ? tl("مدفوع") : tl("نشط")}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Progress Section */}
        {!debt.isPaid && <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{tl("نسبة السداد")}</Text>
              <Text style={[styles.progressVal, {
            color: colors[0]
          }]}>{progress.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
            width: `${progress}%`,
            backgroundColor: colors[0]
          }]} />
            </View>
            <View style={styles.progressLegend}>
              <Text style={styles.legendText}>{tl("تم دفع:")}{formatCurrency(debt.totalAmount - debt.remainingAmount)}</Text>
            </View>
          </View>}

        {/* Action Buttons */}
        {!debt.isPaid && <View style={styles.mainActions}>
            <AppButton label={debt.direction === 'owed_to_me' ? tl("تسجيل دفعة مستلمة") : tl("دفع مبلغ من الدين")} onPress={handlePayDebt} variant="primary" size="lg" leftIcon="cash-outline" style={{
          backgroundColor: colors[0],
          borderRadius: 16
        }} />
          </View>}

        {/* Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{tl("التفاصيل")}</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{tl("تاريخ البدء")}</Text>
              <Text style={styles.infoValue}>{formatDate(debt.startDate)}</Text>
            </View>
          </View>

          {debt.dueDate && <View style={styles.infoRow}>
              <View style={[styles.infoIconBox, getDaysUntilDue(debt.dueDate)! < 0 && !debt.isPaid && {
            backgroundColor: theme.colors.error + '10'
          }]}>
                <Ionicons name="timer-outline" size={20} color={!debt.isPaid && getDaysUntilDue(debt.dueDate)! < 0 ? theme.colors.error : theme.colors.textSecondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{tl("موعد الاستحقاق النهائي")}</Text>
                <Text style={[styles.infoValue, !debt.isPaid && getDaysUntilDue(debt.dueDate)! < 0 && {
              color: theme.colors.error,
              fontWeight: '700'
            }]}>
                  {formatDate(debt.dueDate)}
                  {!debt.isPaid && getDaysUntilDue(debt.dueDate)! < 0 && tl(" (متأخر)")}
                </Text>
              </View>
            </View>}

          {debt.description && <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{tl("ملاحظات")}</Text>
                <Text style={styles.infoValue}>{debt.description}</Text>
              </View>
            </View>}
        </View>

        {/* Installments Section */}
        {installments.length > 0 && <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{tl("الأقساط")}</Text>
              <View style={styles.badgeSm}>
                <Text style={styles.badgeSmText}>{paidInstallments.length}/{installments.length}</Text>
              </View>
            </View>

            {unpaidInstallments.map(inst => {
          const days = getDaysUntilDue(inst.dueDate);
          const isOverdue = days !== null && days < 0;
          return <View key={inst.id} style={styles.installmentItemRow}>
                  <View style={styles.instLeft}>
                    <View style={[styles.instNum, {
                borderColor: isOverdue ? theme.colors.error : theme.colors.border
              }]}>
                      <Text style={[styles.instNumText, isOverdue && {
                  color: theme.colors.error
                }]}>{inst.installmentNumber}</Text>
                    </View>
                    <View>
                      <Text style={styles.instAmount}>{formatCurrency(inst.amount)}</Text>
                      <Text style={[styles.instDate, isOverdue && {
                  color: theme.colors.error
                }]}>
                        {formatDate(inst.dueDate)} {isOverdue && tl(" (متأخر)")}
                      </Text>
                    </View>
                  </View>
                  {!debt.isPaid && <TouchableOpacity style={[styles.instPayBtn, {
              backgroundColor: colors[0]
            }]} onPress={() => handlePayInstallment(inst)}>
                      <Text style={styles.instPayBtnText}>{tl("دفع")}</Text>
                    </TouchableOpacity>}
                </View>;
        })}

            {paidInstallments.map(inst => <View key={inst.id} style={[styles.installmentItemRow, {
          opacity: 0.6
        }]}>
                <View style={styles.instLeft}>
                  <View style={[styles.instNum, {
              backgroundColor: theme.colors.success + '20',
              borderColor: 'transparent'
            }]}>
                    <Ionicons name="checkmark" size={12} color={theme.colors.success} />
                  </View>
                  <View>
                    <Text style={styles.instAmount}>{formatCurrency(inst.amount)}</Text>
                    <Text style={styles.instDate}>{formatDate(inst.dueDate)}{tl("(مدفوع)")}</Text>
                  </View>
                </View>
              </View>)}
          </View>}

        {/* History Section */}
        {payments.length > 0 && <View style={styles.card}>
            <Text style={styles.cardTitle}>{tl("سجل المدفوعات")}</Text>
            {payments.map(p => <View key={p.id} style={styles.historyItem}>
                <View style={styles.historyIconBox}>
                  <Ionicons name="receipt-outline" size={18} color={theme.colors.success} />
                </View>
                <View style={styles.historyContent}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyAmount}>{formatCurrency(p.amount)}</Text>
                    <Text style={styles.historyDate}>{formatDate(p.paymentDate)}</Text>
                  </View>
                  <Text style={styles.historyNote}>{p.description || tl("تسديد جزء من الدين")}</Text>
                </View>
              </View>)}
          </View>}

        <View style={{
        height: 40
      }} />
      </ScrollView>

      <ConfirmAlert visible={showDeleteAlert} onCancel={() => setShowDeleteAlert(false)} onConfirm={confirmDelete} title={tl("حذف الالتزام")} message={tl("هل أنت متأكد من حذف هذا الالتزام وجميع السجلات الملحقة به؟ هذا الإجراء لا يمكن التراجع عنه.")} confirmText={tl("نعم، حذف")} cancelText={tl("إلغاء")} type="danger" />

      <PayDebtModal visible={showPayModal} debt={debt} onClose={() => setShowPayModal(false)} onPay={handlePayDebtConfirm} />
    </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 40
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0
  },
  summaryCard: {
    margin: 20,
    borderRadius: 32,
    padding: 24,
    minHeight: 220,
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)'
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
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 24,
    padding: 20,
    ...getPlatformShadow('sm')
  },
  cardHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  progressVal: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('900')
  },
  progressTrack: {
    height: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12
  },
  progressFill: {
    height: '100%',
    borderRadius: 6
  },
  progressLegend: {
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  legendText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  mainActions: {
    paddingHorizontal: 20,
    marginBottom: 24
  },
  infoRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left'
  },
  infoValue: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    textAlign: isRTL ? 'right' : 'left'
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 8
  },
  badgeSmText: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary
  },
  installmentItemRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '50'
  },
  instLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12
  },
  instNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  instNumText: {
    fontSize: 12,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textSecondary
  },
  instAmount: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  instDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  instPayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12
  },
  instPayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: getPlatformFontWeight('700')
  },
  historyItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '50'
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.success + '10',
    alignItems: 'center',
    justifyContent: 'center'
  },
  historyContent: {
    flex: 1
  },
  historyTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.success
  },
  historyDate: {
    fontSize: 11,
    color: theme.colors.textSecondary
  },
  historyNote: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left'
  },
  deleteWarningText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.error,
    backgroundColor: theme.colors.error + '10',
    padding: 10,
    borderRadius: 12,
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: 20
  }
});
