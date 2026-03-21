import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, RefreshControl, Image, Dimensions, Modal, Pressable } from 'react-native';
import { ScreenContainer, AppHeader } from '../design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getBillById, deleteBill, getBillPayments, Bill, BillPayment } from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { BILL_CATEGORIES, BillCategory } from '../types';
import { markBillAsPaid, markBillAsUnpaid, getBillPaymentHistory } from '../services/billService';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { ConfirmAlert } from '../components/ConfirmAlert';
import { tl, useLocalization } from "../localization";
const {
  width
} = Dimensions.get('window');
export const BillDetailsScreen = ({
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
  const [bill, setBill] = useState<Bill | null>(null);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const billId = route.params?.billId;
  const loadBillData = async () => {
    if (!billId) return;
    try {
      const billData = await getBillById(billId);
      if (billData) {
        setBill(billData);
        // Sync bill data with navigation params for the header edit button
        navigation.setParams({
          bill: billData
        });
        const paymentsData = await getBillPaymentHistory(billId);
        setPayments(paymentsData);
      }
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء تحميل بيانات الفاتورة"));
    }
  };
  useEffect(() => {
    loadBillData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadBillData();
    });
    return unsubscribe;
  }, [navigation, billId]);
  const onRefresh = async () => {
    setRefreshing(true);
    await loadBillData();
    setRefreshing(false);
  };
  const handleTogglePaid = async () => {
    if (!bill) return;
    try {
      if (bill.isPaid) {
        await markBillAsUnpaid(bill.id);
        alertService.toastSuccess(tl("تم تحديث حالة الفاتورة"));
      } else {
        await markBillAsPaid(bill.id);
        alertService.toastSuccess(tl("تم دفع الفاتورة بنجاح"));
      }
      await loadBillData();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء تحديث حالة الفاتورة"));
    }
  };
  const handleEdit = () => {
    if (bill) {
      navigation.navigate('AddBill', {
        bill
      });
    }
  };
  const handleDelete = () => {
    setShowDeleteAlert(true);
  };
  const confirmDelete = async () => {
    if (!bill) return;
    try {
      await deleteBill(bill.id);
      alertService.toastSuccess(tl("تم حذف الفاتورة بنجاح"));
      navigation.goBack();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حذف الفاتورة"));
    }
  };
  const getCategoryInfo = (category: string) => {
    return BILL_CATEGORIES[category as BillCategory] || BILL_CATEGORIES.other;
  };
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };
  if (!bill) {
    return <ScreenContainer scrollable={false}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{tl("جاري التحميل...")}</Text>
        </View>
      </ScreenContainer>;
  }
  const daysUntilDue = getDaysUntilDue(bill.dueDate);
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;
  const categoryInfo = getCategoryInfo(bill.category);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return <ScreenContainer scrollable={false} edges={['left', 'right', 'bottom']}>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}>
        {/* Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient colors={bill.isPaid ? [theme.colors.surfaceCard, theme.colors.surfaceLight] : isOverdue ? [theme.colors.error + '10', theme.colors.surfaceCard] : isDueSoon ? [theme.colors.warning + '10', theme.colors.surfaceCard] : [theme.colors.surfaceCard, theme.colors.surfaceLight]} start={{
          x: 0,
          y: 0
        }} end={{
          x: 0,
          y: 1
        }} style={styles.headerGradient}>
            <View style={styles.headerTop}>
              <View style={[styles.categoryIconBadge, {
              backgroundColor: categoryInfo.color + '15'
            }]}>
                <Ionicons name={categoryInfo.icon as any} size={36} color={categoryInfo.color} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.billTitle}>{bill.title}</Text>
                <Text style={styles.billCategory}>{tl(categoryInfo.label)}</Text>
              </View>
            </View>

            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>{tl("إجمالي المبلغ")}</Text>
              <Text style={[styles.amountValue, bill.isPaid && styles.amountValuePaid]}>
                {formatCurrency(bill.amount)}
              </Text>
              {bill.isPaid && <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                  <Text style={styles.paidText}>{tl("تم دفع الفاتورة")}</Text>
                </View>}
            </View>

            {bill.image_path && <TouchableOpacity style={styles.imageContainer} onPress={() => setShowImageModal(true)} activeOpacity={0.9}>
                <Image source={{
              uri: bill.image_path
            }} style={styles.billImage} />
                <View style={styles.imageOverlay}>
                  <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.imageOverlayText}>{tl("عرض المرفق")}</Text>
                </View>
              </TouchableOpacity>}
          </LinearGradient>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>{tl("بيانات الاستحقاق")}</Text>

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, {
            backgroundColor: '#3B82F615'
          }]}>
              <Ionicons name="calendar-clear" size={20} color="#3B82F6" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>{tl("تاريخ الاستحقاق")}</Text>
              <Text style={styles.detailValue}>{formatDate(bill.dueDate)}</Text>
              {!bill.isPaid && daysUntilDue !== null && <View style={[styles.statusBadge, isOverdue && styles.statusBadgeOverdue, isDueSoon && !isOverdue && styles.statusBadgeDueSoon]}>
                  <Text style={[styles.statusText, {
                color: isOverdue ? theme.colors.error : isDueSoon ? theme.colors.warning : theme.colors.textPrimary
              }]}>
                    {isOverdue ? tl("متأخرة {{}} يوم", [Math.abs(daysUntilDue)]) : daysUntilDue === 0 ? tl("مستحقة اليوم") : tl("متبقي {{}} يوم", [daysUntilDue])}
                  </Text>
                </View>}
            </View>
          </View>

          {bill.recurrenceType && <View style={styles.detailRow}>
              <View style={[styles.detailIcon, {
            backgroundColor: '#8B5CF615'
          }]}>
                <Ionicons name="refresh" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{tl("تكرار الفاتورة")}</Text>
                <Text style={styles.detailValue}>
                  {bill.recurrenceType === 'monthly' ? tl("تقائياً كل شهر") : bill.recurrenceType === 'weekly' ? tl("تلقائياً كل أسبوع") : bill.recurrenceType === 'quarterly' ? tl("كل 3 أشهر") : tl("سنوياً")}
                </Text>
              </View>
            </View>}

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, {
            backgroundColor: '#F59E0B15'
          }]}>
              <Ionicons name="notifications" size={20} color="#F59E0B" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>{tl("تنبيهات الدفع")}</Text>
              <Text style={styles.detailValue}>{tl("تذكير قبل")}{bill.reminderDaysBefore}{tl("أيام")}</Text>
            </View>
          </View>

          {bill.description && <View style={styles.detailRow}>
              <View style={[styles.detailIcon, {
            backgroundColor: '#6B728015'
          }]}>
                <Ionicons name="document-text" size={20} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{tl("ملاحظات إضافية")}</Text>
                <Text style={styles.detailValue}>{bill.description}</Text>
              </View>
            </View>}
        </View>

        {/* Payment History */}
        {payments.length > 0 && <View style={styles.paymentsCard}>
            <Text style={styles.sectionTitle}>{tl("سجل عمليات الدفع")}</Text>
            {payments.map(payment => <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentDate}>{formatDate(payment.paymentDate)}</Text>
                  {payment.description && <Text style={styles.paymentDescription}>{payment.description}</Text>}
                </View>
                <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
              </View>)}
            <View style={styles.totalPaidRow}>
              <Text style={styles.totalPaidLabel}>{tl("إجمالي المدفوعات")}</Text>
              <Text style={styles.totalPaidAmount}>{formatCurrency(totalPaid)}</Text>
            </View>
          </View>}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity onPress={handleTogglePaid} activeOpacity={0.8} style={[styles.actionButton, bill.isPaid ? styles.actionButtonSecondary : styles.actionButtonPrimary]}>
            <Ionicons name={bill.isPaid ? "close-circle" : "checkmark-circle"} size={24} color={bill.isPaid ? theme.colors.textPrimary : "#FFFFFF"} />
            <Text style={[styles.actionButtonText, bill.isPaid && styles.actionButtonTextSecondary]}>
              {bill.isPaid ? tl("إلغاء حالة الدفع") : tl("تسجيل الدفع الآن")}
            </Text>
          </TouchableOpacity>

          <View style={{
          flexDirection: isRTL ? 'row' : 'row-reverse',
          gap: 12
        }}>
            <TouchableOpacity onPress={handleEdit} activeOpacity={0.8} style={[styles.actionButton, styles.actionButtonSecondary, {
            flex: 1
          }]}>
              <Ionicons name="pencil" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.actionButtonTextSecondary}>{tl("تعديل")}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDelete} activeOpacity={0.8} style={[styles.actionButton, styles.actionButtonDanger, {
            flex: 1
          }]}>
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{tl("حذف")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ConfirmAlert visible={showDeleteAlert} title={tl("حذف الفاتورة")} message={tl("هل أنت متأكد من حذف الفاتورة \"{{}}\"؟", [bill.title])} onConfirm={confirmDelete} onCancel={() => setShowDeleteAlert(false)} />

      {/* Full Screen Image Modal */}
      <Modal visible={showImageModal} transparent={true} animationType="fade" onRequestClose={() => setShowImageModal(false)}>
        <Pressable style={styles.imageModalOverlay} onPress={() => setShowImageModal(false)}>
          <View style={styles.imageModalContent}>
            <TouchableOpacity style={styles.imageModalCloseButton} onPress={() => setShowImageModal(false)}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {bill?.image_path && <Image source={{
            uri: bill.image_path
          }} style={styles.fullScreenImage} resizeMode="contain" />}
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl + 8
  },
  headerCard: {
    borderRadius: theme.borderRadius.xxl + 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceCard,
    ...getPlatformShadow('md')
  },
  headerGradient: {
    padding: theme.spacing.lg
  },
  headerTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  categoryIconBadge: {
    width: 72,
    height: 72,
    borderRadius: theme.borderRadius.xxl - 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: theme.spacing.md,
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  billTitle: {
    fontSize: theme.typography.sizes.xxl - 2,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4
  },
  billCategory: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily
  },
  amountSection: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.xxl,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border + '30'
  },
  amountLabel: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    opacity: 0.8
  },
  amountValue: {
    fontSize: theme.typography.sizes.display,
    fontWeight: getPlatformFontWeight('900'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  amountValuePaid: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
    opacity: 0.6
  },
  paidBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl - 2,
    backgroundColor: theme.colors.success + '15',
    borderWidth: 1,
    borderColor: theme.colors.success + '20'
  },
  paidText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.success,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700')
  },
  imageContainer: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.xxl - 4,
    overflow: 'hidden',
    position: 'relative',
    height: 200,
    ...getPlatformShadow('sm')
  },
  billImage: {
    width: '100%',
    height: '100%'
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700')
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.borderRadius.round,
    padding: theme.spacing.sm
  },
  fullScreenImage: {
    width: width,
    height: '100%'
  },
  detailsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xxl + 4,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md + 4,
    ...getPlatformShadow('sm')
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.lg,
    textAlign: isRTL ? 'right' : 'left'
  },
  detailRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginBottom: theme.spacing.lg,
    alignItems: 'center'
  },
  detailIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center'
  },
  detailContent: {
    flex: 1,
    marginHorizontal: theme.spacing.md,
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  detailLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    marginBottom: 4
  },
  detailValue: {
    fontSize: theme.typography.sizes.md - 1,
    color: theme.colors.textPrimary,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.md + 2,
    marginTop: 6
  },
  statusBadgeOverdue: {
    backgroundColor: theme.colors.error + '10'
  },
  statusBadgeDueSoon: {
    backgroundColor: theme.colors.warning + '10'
  },
  statusText: {
    fontSize: theme.typography.sizes.xs - 1,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700')
  },
  paymentsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md + 4,
    ...getPlatformShadow('sm')
  },
  paymentRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md - 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '40'
  },
  paymentInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start'
  },
  paymentDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2
  },
  paymentDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily
  },
  paymentAmount: {
    fontSize: theme.typography.sizes.md - 1,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.success,
    fontFamily: theme.typography.fontFamily
  },
  totalPaidRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm + 4,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border + '80',
    borderStyle: 'dashed'
  },
  totalPaidLabel: {
    fontSize: theme.typography.sizes.md - 1,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  totalPaidAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('900'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily
  },
  actionsContainer: {
    gap: theme.spacing.sm + 4,
    marginTop: theme.spacing.sm
  },
  actionButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xxl - 4,
    gap: theme.spacing.sm + 2,
    ...getPlatformShadow('sm')
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.primary
  },
  actionButtonSecondary: {
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: theme.colors.border
  },
  actionButtonDanger: {
    backgroundColor: theme.colors.error
  },
  actionButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily
  },
  actionButtonTextSecondary: {
    color: theme.colors.textPrimary
  }
});
