import React, { useState, useEffect, useLayoutEffect } from 'react';
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
import { theme } from '../utils/theme';
import { 
  getDebt,
  getDebtInstallments,
  deleteDebt,
  Debt,
  DebtInstallment,
} from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { DEBT_TYPES } from '../types';
import { payDebt, payInstallment } from '../services/debtService';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { ConfirmAlert } from '../components/ConfirmAlert';

export const DebtDetailsScreen = ({ navigation, route }: any) => {
  const { formatCurrency } = useCurrency();
  const [debt, setDebt] = useState<Debt | null>(null);
  const [installments, setInstallments] = useState<DebtInstallment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const debtId = route.params?.debtId;

  const loadDebtData = async () => {
    if (!debtId) return;
    
    try {
      const debtData = await getDebt(debtId);
      if (debtData) {
        setDebt(debtData);
        const installmentsData = await getDebtInstallments(debtId);
        setInstallments(installmentsData.sort((a, b) => a.installmentNumber - b.installmentNumber));
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDebtData();
    setRefreshing(false);
  };

  const handlePayDebt = async () => {
    if (!debt) return;
    try {
      await payDebt(debt.id);
      await loadDebtData();
      alertService.success('نجح', 'تم دفع الدين بنجاح');
    } catch (error) {
      console.error('Error paying debt:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء دفع الدين');
    }
  };

  const handlePayInstallment = async (installment: DebtInstallment) => {
    try {
      await payInstallment(installment.id);
      await loadDebtData();
      alertService.success('نجح', 'تم دفع القسط بنجاح');
    } catch (error) {
      console.error('Error paying installment:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء دفع القسط');
    }
  };

  const handleEdit = () => {
    if (debt && !debt.isPaid) {
      navigation.navigate('Debts', { 
        screen: 'DebtsList',
        params: { editDebt: debt }
      });
    }
  };

  const handleDelete = () => {
    if (debt?.isPaid) {
      setShowDeleteAlert(true);
    }
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
            <Text style={styles.debtorName}>مدين لـ: {debt.debtorName}</Text>
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
                  debt.isPaid && { color: '#059669', fontWeight: '700' }
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
                          <Text style={styles.payInstallmentButtonText}>دفع</Text>
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

        {/* Actions - Only show for unpaid debts */}
        {!debt.isPaid && (
          <View style={styles.actionsCard}>
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
                <Text style={styles.payFullButtonText}>دفع الدين بالكامل</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEdit}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={20} color={theme.colors.primary} />
              <Text style={styles.editButtonText}>تعديل</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions for paid debts - Only delete option with strong warning */}
        {debt.isPaid && (
          <View style={styles.actionsCard}>
            <TouchableOpacity
              style={[styles.deleteButton, styles.deleteButtonPaid]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={[styles.deleteButtonText, styles.deleteButtonTextPaid]}>حذف الدين المدفوع</Text>
            </TouchableOpacity>
            <Text style={styles.deleteWarningText}>
              ⚠️ تحذير: حذف الدين المدفوع سيؤدي إلى حذف جميع السجلات المرتبطة به بشكل دائم
            </Text>
          </View>
        )}
      </ScrollView>

      <ConfirmAlert
        visible={showDeleteAlert}
        onCancel={() => setShowDeleteAlert(false)}
        onConfirm={confirmDelete}
        title="⚠️ حذف دين مدفوع"
        message={`هل أنت متأكد تماماً من حذف هذا الدين المدفوع؟\n\nسيتم حذف:\n• الدين بالكامل\n• جميع الأقساط المرتبطة به\n• جميع السجلات التاريخية\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه!`}
        confirmText="نعم، احذف"
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
    direction: 'rtl',
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
    padding: theme.spacing.md,
  },
  headerCard: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    ...theme.shadows.lg,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  debtorName: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  debtType: {
    fontSize: theme.typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.lg,
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  totalAmount: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
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
    marginTop: theme.spacing.xs,
  },
  paidStatusText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  paidBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.md,
  },
  paidTextHeader: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  progressCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  paymentSummaryCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: '#10B981',
    ...theme.shadows.md,
  },
  paymentSummaryHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  paymentSummaryTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: '#10B981',
    fontFamily: theme.typography.fontFamily,
  },
  paymentSummaryContent: {
    gap: theme.spacing.md,
  },
  paymentSummaryRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
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
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  progressHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  progressTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  progressPercentage: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  progressBarContainer: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.md,
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
    marginBottom: theme.spacing.xs,
  },
  progressStatValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  detailsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    gap: theme.spacing.md,
  },
  detailItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  detailValue: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  overdueText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  dueSoonText: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  paidText: {
    color: '#10B981',
    fontWeight: '600',
  },
  installmentsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  sectionHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  installmentsSummary: {
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  installmentsSummaryText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  installmentsSection: {
    marginTop: theme.spacing.lg,
  },
  installmentsSubtitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
  },
  installmentItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  paidInstallmentItem: {
    opacity: 0.7,
  },
  installmentLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  installmentNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installmentNumber: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily,
  },
  installmentInfo: {
    flex: 1,
  },
  installmentAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  installmentDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  payInstallmentButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  payInstallmentButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  payInstallmentButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  paidBadgeSmall: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  paidBadgeText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    color: '#059669',
    fontFamily: theme.typography.fontFamily,
  },
  actionsCard: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  payFullButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  payFullButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  payFullButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  editButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  deleteButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  deleteButtonPaid: {
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 2,
    borderColor: theme.colors.error,
    borderStyle: 'dashed',
  },
  deleteButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
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
    lineHeight: 20,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.error + '10',
    borderRadius: theme.borderRadius.md,
  },
});
