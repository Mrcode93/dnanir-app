import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import {
  getDebt,
  getDebtInstallments,
  deleteDebt,
  getDebtPayments,
  Debt,
  DebtInstallment,
  DebtPayment,
} from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { DEBT_TYPES } from '../types';
import { payDebt, payInstallment } from '../services/debtService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { PayDebtModal } from '../components/PayDebtModal';

export const DebtDetailsScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
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
      console.error('Error loading debt data:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء تحميل بيانات الدين');
    }
  };

  useEffect(() => {
    loadDebtData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadDebtData();
    });
    return unsubscribe;
  }, [navigation, debtId]);

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
      const message = isOwedToMe
        ? (amount === debt.remainingAmount ? 'تم تسجيل التسديد بالكامل وتمت إضافته لرصيدك' : `تم تسجيل تسديد ${formatCurrency(amount)} وتمت إضافته لرصيدك`)
        : (amount === debt.remainingAmount ? 'تم دفع الدين بالكامل بنجاح' : `تم دفع ${formatCurrency(amount)} بنجاح`);
      alertService.success('نجح', message);
      setShowPayModal(false);
    } catch (error) {
      console.error('Error paying debt:', error);
      alertService.error('خطأ', debt.direction === 'owed_to_me' ? 'حدث خطأ أثناء تسجيل التسديد' : 'حدث خطأ أثناء دفع الدين');
      throw error;
    }
  };

  const handlePayInstallment = async (installment: DebtInstallment) => {
    if (!debt) return;
    try {
      await payInstallment(installment.id);
      await loadDebtData();
      const isOwedToMe = debt.direction === 'owed_to_me';
      alertService.success('نجح', isOwedToMe ? 'تم تسجيل تسديد القسط وإضافته لرصيدك' : 'تم دفع القسط بنجاح');
    } catch (error) {
      console.error('Error paying installment:', error);
      alertService.error('خطأ', debt.direction === 'owed_to_me' ? 'حدث خطأ أثناء تسجيل تسديد القسط' : 'حدث خطأ أثناء دفع القسط');
    }
  };

  const handleEdit = () => {
    if (debt) {
      navigation.replace('AddDebt', { debt });
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
      alertService.success('نجح', 'تم حذف الدين بنجاح');
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting debt:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حذف الدين');
    }
  };

  if (!debt) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  // Use green colors for paid debts, original colors for unpaid
  const baseColors = typeColors[debt.type];
  const colors = debt.isPaid
    ? ['#10B981', '#059669'] // Green gradient for paid debts
    : baseColors;
  const paidInstallments = installments.filter(inst => inst.isPaid);
  const unpaidInstallments = installments.filter(inst => !inst.isPaid);
  const progress = debt.totalAmount > 0
    ? ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100
    : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'غير محدد';
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <LinearGradient
          colors={colors as any}
          style={styles.headerCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name={typeIcons[debt.type] as any} size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.debtorName}>{debt.direction === 'owed_to_me' ? 'مدين لي:' : 'مدين لـ:'} {debt.debtorName}</Text>
            <Text style={styles.debtType}>{DEBT_TYPES[debt.type]}</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.totalAmount}>{formatCurrency(debt.totalAmount)}</Text>
              {debt.isPaid ? (
                <View style={styles.paidStatusContainer}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.paidStatusText}>مدفوع بالكامل</Text>
                </View>
              ) : (
                <Text style={styles.remainingAmount}>
                  متبقي: {formatCurrency(debt.remainingAmount)}
                </Text>
              )}
            </View>
            {debt.isPaid && (
              <View style={styles.paidBadge}>
                <Ionicons name="trophy" size={20} color="#FFFFFF" />
                <Text style={styles.paidText}>تم إتمام الدفع بنجاح</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Progress Card - Show for unpaid debts */}
        {!debt.isPaid && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>التقدم</Text>
              <Text style={styles.progressPercentage}>{progress.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={baseColors as any}
                  style={[styles.progressFill, { width: `${progress}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
            </View>
            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatLabel}>مدفوع</Text>
                <Text style={styles.progressStatValue}>
                  {formatCurrency(debt.totalAmount - debt.remainingAmount)}
                </Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatLabel}>متبقي</Text>
                <Text style={[styles.progressStatValue, { color: '#EF4444' }]}>
                  {formatCurrency(debt.remainingAmount)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Summary Card - Show for paid debts */}
        {debt.isPaid && (
          <View style={styles.paymentSummaryCard}>
            <View style={styles.paymentSummaryHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.paymentSummaryTitle}>تم الدفع بالكامل</Text>
            </View>
            <View style={styles.paymentSummaryContent}>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>المبلغ الإجمالي</Text>
                <Text style={styles.paymentSummaryValue}>
                  {formatCurrency(debt.totalAmount)}
                </Text>
              </View>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>الدائن</Text>
                <Text style={styles.paymentSummaryValue}>
                  {debt.debtorName}
                </Text>
              </View>
              <View style={styles.paymentSummaryRow}>
                <Text style={styles.paymentSummaryLabel}>تاريخ الإتمام</Text>
                <Text style={styles.paymentSummaryValue}>
                  {formatDate(debt.startDate)}
                </Text>
              </View>
              {installments.length > 0 && (
                <View style={styles.paymentSummaryRow}>
                  <Text style={styles.paymentSummaryLabel}>عدد الأقساط</Text>
                  <Text style={styles.paymentSummaryValue}>
                    {installments.length} قسط
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>التفاصيل</Text>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>تاريخ البدء</Text>
                <Text style={styles.detailValue}>{formatDate(debt.startDate)}</Text>
              </View>
            </View>
            {debt.dueDate && (
              <View style={styles.detailItem}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={
                    debt.isPaid
                      ? '#10B981'
                      : getDaysUntilDue(debt.dueDate)! < 0
                        ? '#DC2626'
                        : theme.colors.textSecondary
                  }
                />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>تاريخ الاستحقاق</Text>
                  <Text style={[
                    styles.detailValue,
                    debt.isPaid && styles.paidText,
                    !debt.isPaid && getDaysUntilDue(debt.dueDate)! < 0 && styles.overdueText
                  ]}>
                    {formatDate(debt.dueDate)}
                    {debt.isPaid && ' ✓'}
                  </Text>
                </View>
              </View>
            )}
            {debt.description && (
              <View style={styles.detailItem}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>الوصف</Text>
                  <Text style={styles.detailValue}>{debt.description}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Installments Card */}
        {installments.length > 0 && (
          <View style={styles.installmentsCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>الأقساط</Text>
              <View style={[
                styles.installmentsSummary,
                debt.isPaid && { backgroundColor: '#D1FAE5' }
              ]}>
                <Text style={[
                  styles.installmentsSummaryText,
                  debt.isPaid && { color: '#059669', fontWeight: getPlatformFontWeight('700') }
                ]}>
                  {debt.isPaid
                    ? `✓ ${paidInstallments.length}/${installments.length} مدفوعة بالكامل`
                    : `${paidInstallments.length}/${installments.length} مدفوعة`
                  }
                </Text>
              </View>
            </View>

            {/* Unpaid Installments */}
            {unpaidInstallments.length > 0 && !debt.isPaid && (
              <View style={styles.installmentsSection}>
                <Text style={styles.installmentsSubtitle}>المستحقة ({unpaidInstallments.length})</Text>
                {unpaidInstallments.map((inst) => {
                  const daysUntilDue = getDaysUntilDue(inst.dueDate);
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;

                  return (
                    <TouchableOpacity
                      key={inst.id}
                      style={styles.installmentItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        // Navigate to installment details if needed
                      }}
                    >
                      <View style={styles.installmentLeft}>
                        <View style={[
                          styles.installmentNumberBadge,
                          { backgroundColor: isOverdue ? '#FEE2E2' : isDueSoon ? '#FEF3C7' : colors[0] + '20' }
                        ]}>
                          <Text style={[
                            styles.installmentNumber,
                            { color: isOverdue ? '#DC2626' : isDueSoon ? '#F59E0B' : colors[0] }
                          ]}>
                            {inst.installmentNumber}
                          </Text>
                        </View>
                        <View style={styles.installmentInfo}>
                          <Text style={styles.installmentAmount}>{formatCurrency(inst.amount)}</Text>
                          <Text style={[
                            styles.installmentDate,
                            isOverdue && styles.overdueText,
                            isDueSoon && styles.dueSoonText
                          ]}>
                            {formatDate(inst.dueDate)}
                            {isOverdue && ' (متأخر)'}
                            {isDueSoon && daysUntilDue === 0 && ' (اليوم!)'}
                            {isDueSoon && daysUntilDue! > 0 && ` (بعد ${daysUntilDue} يوم)`}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.payInstallmentButton}
                        onPress={() => handlePayInstallment(inst)}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={['#10B981', '#059669'] as any}
                          style={styles.payInstallmentButtonGradient}
                        >
                          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.payInstallmentButtonText}>{debt.direction === 'owed_to_me' ? 'تسديد' : 'دفع'}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Paid Installments */}
            {paidInstallments.length > 0 && (
              <View style={styles.installmentsSection}>
                <Text style={styles.installmentsSubtitle}>
                  {debt.isPaid ? 'جميع الأقساط المدفوعة' : `المدفوعة (${paidInstallments.length})`}
                </Text>
                {paidInstallments.map((inst) => (
                  <View key={inst.id} style={[styles.installmentItem, styles.paidInstallmentItem]}>
                    <View style={styles.installmentLeft}>
                      <View style={[styles.installmentNumberBadge, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="checkmark-circle" size={16} color="#059669" />
                      </View>
                      <View style={styles.installmentInfo}>
                        <Text style={styles.installmentAmount}>{formatCurrency(inst.amount)}</Text>
                        <Text style={styles.installmentDate}>
                          {formatDate(inst.dueDate)}
                          {inst.paidDate && ` • دُفع في ${formatDate(inst.paidDate)}`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paidBadgeSmall}>
                      <Text style={styles.paidBadgeText}>مدفوع</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Payment History Card */}
        {payments.length > 0 && (
          <View style={styles.paymentHistoryCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>سجل المدفوعات</Text>
              <View style={styles.paymentHistorySummary}>
                <Text style={styles.paymentHistorySummaryText}>
                  {payments.length} {payments.length === 1 ? 'دفعة' : 'دفعة'}
                </Text>
              </View>
            </View>
            <View style={styles.paymentHistoryList}>
              {payments.map((payment) => {
                const installment = installments.find(inst => inst.id === payment.installmentId);
                return (
                  <View key={payment.id} style={styles.paymentHistoryItem}>
                    <View style={styles.paymentHistoryLeft}>
                      <View style={[styles.paymentHistoryIcon, { backgroundColor: '#10B98120' }]}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      </View>
                      <View style={styles.paymentHistoryInfo}>
                        <Text style={styles.paymentHistoryAmount}>
                          {formatCurrency(payment.amount)}
                        </Text>
                        <Text style={styles.paymentHistoryDescription}>
                          {payment.description || (installment ? `القسط رقم ${installment.installmentNumber}` : 'دفع الدين')}
                        </Text>
                        <Text style={styles.paymentHistoryDate}>
                          {formatDate(payment.paymentDate)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Actions Card */}
        <View style={styles.actionsCard}>
          {!debt.isPaid && (
            <TouchableOpacity
              style={styles.payFullButton}
              onPress={handlePayDebt}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={baseColors as any}
                style={styles.payFullButtonGradient}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.payFullButtonText}>{debt.direction === 'owed_to_me' ? 'تسديد (استلام)' : 'دفع الدين'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={20} color={theme.colors.primary} />
              <Text style={styles.editButtonText}>تعديل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteButton, debt.isPaid && styles.deleteButtonPaid]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={[styles.deleteButtonText, debt.isPaid && styles.deleteButtonTextPaid]}>
                {debt.isPaid ? 'حذف الدين المدفوع' : 'حذف الدين'}
              </Text>
            </TouchableOpacity>
          </View>

          {debt.isPaid && (
            <Text style={styles.deleteWarningText}>
              ⚠️ تحذير: حذف الدين المدفوع سيؤدي إلى حذف جميع السجلات المرتبطة به بشكل دائم
            </Text>
          )}
        </View>
      </ScrollView>

      <ConfirmAlert
        visible={showDeleteAlert}
        onCancel={() => setShowDeleteAlert(false)}
        onConfirm={confirmDelete}
        title={debt.isPaid ? '⚠️ حذف دين مدفوع' : 'حذف الدين'}
        message={
          debt.isPaid
            ? `هل أنت متأكد تماماً من حذف هذا الدين المدفوع؟\n\nسيتم حذف:\n• الدين بالكامل\n• جميع الأقساط المرتبطة به\n• جميع السجلات التاريخية\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه!`
            : 'هل أنت متأكد من حذف هذا الدين؟ سيتم حذف جميع الأقساط والسقوف المرتبطة به. لا يمكن التراجع عن هذا الإجراء.'
        }
        confirmText={debt.isPaid ? 'نعم، احذف الكل' : 'حذف'}
        cancelText="إلغاء"
        type="danger"
      />

      <PayDebtModal
        visible={showPayModal}
        debt={debt}
        onClose={() => setShowPayModal(false)}
        onPay={handlePayDebtConfirm}
      />
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.sm,
  },
  headerCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...getPlatformShadow('lg'),
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xs,
  },
  debtorName: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  debtType: {
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  totalAmount: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  remainingAmount: {
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
  },
  paidStatusContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  paidStatusText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  paidBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: 'rgba(35, 9, 9, 0.2)',
    borderRadius: theme.borderRadius.md,
  },
  paidTextHeader: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  progressCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...getPlatformShadow('md'),
  },
  paymentSummaryCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: '#10B981',
    ...getPlatformShadow('md'),
  },
  paymentSummaryHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  paymentSummaryTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: '#10B981',
    fontFamily: theme.typography.fontFamily,
  },
  paymentSummaryContent: {
    gap: theme.spacing.sm,
  },
  paymentSummaryRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  paymentSummaryLabel: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  paymentSummaryValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  progressHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  progressTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  progressPercentage: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  progressBarContainer: {
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: 10,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.sm,
  },
  progressStats: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  progressStatValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  detailsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...getPlatformShadow('md'),
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
    textAlign: isRTL ? 'right' : 'left',
  },
  detailRow: {
    gap: theme.spacing.sm,
  },
  detailItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
    textAlign: isRTL ? 'right' : 'left',
  },
  detailValue: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  overdueText: {
    color: '#DC2626',
    fontWeight: getPlatformFontWeight('600'),
  },
  dueSoonText: {
    color: '#F59E0B',
    fontWeight: getPlatformFontWeight('600'),
  },
  paidText: {
    color: '#10B981',
    fontWeight: getPlatformFontWeight('600'),
  },
  installmentsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...getPlatformShadow('md'),
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  installmentsSummary: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  installmentsSummaryText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  installmentsSection: {
    marginTop: theme.spacing.sm,
  },
  installmentsSubtitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.sm,
  },
  installmentItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  paidInstallmentItem: {
    opacity: 0.7,
  },
  installmentLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  installmentNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installmentNumber: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  installmentInfo: {
    flex: 1,
  },
  installmentAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  installmentDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  payInstallmentButton: {
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  payInstallmentButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  payInstallmentButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  paidBadgeSmall: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  paidBadgeText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('600'),
    color: '#059669',
    fontFamily: theme.typography.fontFamily,
  },
  actionsCard: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  payFullButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  payFullButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  payFullButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  secondaryActions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.sm,
  },
  editButton: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  deleteButton: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  deleteButtonPaid: {
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderStyle: 'dashed',
  },
  deleteButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
  },
  deleteButtonTextPaid: {
    color: theme.colors.error,
  },
  deleteWarningText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: theme.spacing.xs,
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.error + '10',
    borderRadius: theme.borderRadius.sm,
  },
  paymentHistoryCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    ...getPlatformShadow('md'),
  },
  paymentHistorySummary: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  paymentHistorySummaryText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  paymentHistoryList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  paymentHistoryItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.sm,
  },
  paymentHistoryLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.sm,
  },
  paymentHistoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentHistoryInfo: {
    flex: 1,
  },
  paymentHistoryAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#10B981',
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  paymentHistoryDescription: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  paymentHistoryDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});
