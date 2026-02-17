import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import {
  getBillById,
  deleteBill,
  getBillPayments,
  Bill,
  BillPayment,
} from '../database/database';
import { useCurrency } from '../hooks/useCurrency';
import { BILL_CATEGORIES, BillCategory } from '../types';
import { markBillAsPaid, markBillAsUnpaid, getBillPaymentHistory } from '../services/billService';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { ConfirmAlert } from '../components/ConfirmAlert';

const { width } = Dimensions.get('window');

export const BillDetailsScreen = ({ navigation, route }: any) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { formatCurrency } = useCurrency();
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
        const paymentsData = await getBillPaymentHistory(billId);
        setPayments(paymentsData);
      }
    } catch (error) {
      console.error('Error loading bill data:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء تحميل بيانات الفاتورة');
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
        alertService.success('نجح', 'تم تحديث حالة الفاتورة');
      } else {
        await markBillAsPaid(bill.id);
        alertService.success('نجح', 'تم دفع الفاتورة بنجاح');
      }
      await loadBillData();
    } catch (error) {
      console.error('Error toggling bill status:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء تحديث حالة الفاتورة');
    }
  };

  const handleEdit = () => {
    if (bill) {
      navigation.navigate('AddBill', { bill });
    }
  };

  const handleDelete = () => {
    setShowDeleteAlert(true);
  };

  const confirmDelete = async () => {
    if (!bill) return;
    try {
      await deleteBill(bill.id);
      alertService.success('نجح', 'تم حذف الفاتورة بنجاح');
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting bill:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حذف الفاتورة');
    }
  };

  const getCategoryInfo = (category: string) => {
    return BILL_CATEGORIES[category as BillCategory] || BILL_CATEGORIES.other;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const daysUntilDue = getDaysUntilDue(bill.dueDate);
  const isOverdue = daysUntilDue < 0;
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 7;
  const categoryInfo = getCategoryInfo(bill.category);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient
            colors={bill.isPaid
              ? [theme.colors.surfaceCard, theme.colors.surfaceLight]
              : isOverdue
                ? ['#FFF1F2', theme.colors.surfaceCard]
                : isDueSoon
                  ? ['#FFFBEB', theme.colors.surfaceCard]
                  : [theme.colors.surfaceCard, theme.colors.surfaceLight]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerTop}>
              <View style={[styles.categoryIconBadge, { backgroundColor: categoryInfo.color + '15' }]}>
                <Ionicons
                  name={categoryInfo.icon as any}
                  size={36}
                  color={categoryInfo.color}
                />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.billTitle}>{bill.title}</Text>
                <Text style={styles.billCategory}>{categoryInfo.label}</Text>
              </View>
            </View>

            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>إجمالي المبلغ</Text>
              <Text style={[styles.amountValue, bill.isPaid && styles.amountValuePaid]}>
                {formatCurrency(bill.amount)}
              </Text>
              {bill.isPaid && (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={styles.paidText}>تم دفع الفاتورة</Text>
                </View>
              )}
            </View>

            {bill.image_path && (
              <TouchableOpacity
                style={styles.imageContainer}
                onPress={() => setShowImageModal(true)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: bill.image_path }} style={styles.billImage} />
                <View style={styles.imageOverlay}>
                  <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.imageOverlayText}>عرض المرفق</Text>
                </View>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>بيانات الاستحقاق</Text>

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: '#3B82F615' }]}>
              <Ionicons name="calendar-clear" size={20} color="#3B82F6" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>تاريخ الاستحقاق</Text>
              <Text style={styles.detailValue}>{formatDate(bill.dueDate)}</Text>
              {!bill.isPaid && daysUntilDue !== null && (
                <View style={[
                  styles.statusBadge,
                  isOverdue && styles.statusBadgeOverdue,
                  isDueSoon && !isOverdue && styles.statusBadgeDueSoon
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: isOverdue ? '#DC2626' : isDueSoon ? '#B45309' : theme.colors.textPrimary }
                  ]}>
                    {isOverdue ? `متأخرة ${Math.abs(daysUntilDue)} يوم` :
                      daysUntilDue === 0 ? 'مستحقة اليوم' :
                        `متبقي ${daysUntilDue} يوم`}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {bill.recurrenceType && (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: '#8B5CF615' }]}>
                <Ionicons name="refresh" size={20} color="#8B5CF6" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>تكرار الفاتورة</Text>
                <Text style={styles.detailValue}>
                  {bill.recurrenceType === 'monthly' ? 'تقائياً كل شهر' :
                    bill.recurrenceType === 'weekly' ? 'تلقائياً كل أسبوع' :
                      bill.recurrenceType === 'quarterly' ? 'كل 3 أشهر' : 'سنوياً'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="notifications" size={20} color="#F59E0B" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>تنبيهات الدفع</Text>
              <Text style={styles.detailValue}>تذكير قبل {bill.reminderDaysBefore} أيام</Text>
            </View>
          </View>

          {bill.description && (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: '#6B728015' }]}>
                <Ionicons name="document-text" size={20} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>ملاحظات إضافية</Text>
                <Text style={styles.detailValue}>{bill.description}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Payment History */}
        {payments.length > 0 && (
          <View style={styles.paymentsCard}>
            <Text style={styles.sectionTitle}>سجل عمليات الدفع</Text>
            {payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentDate}>{formatDate(payment.paymentDate)}</Text>
                  {payment.description && (
                    <Text style={styles.paymentDescription}>{payment.description}</Text>
                  )}
                </View>
                <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
              </View>
            ))}
            <View style={styles.totalPaidRow}>
              <Text style={styles.totalPaidLabel}>إجمالي المدفوعات</Text>
              <Text style={styles.totalPaidAmount}>{formatCurrency(totalPaid)}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={handleTogglePaid}
            activeOpacity={0.8}
            style={[styles.actionButton, bill.isPaid ? styles.actionButtonSecondary : styles.actionButtonPrimary]}
          >
            <Ionicons
              name={bill.isPaid ? "close-circle" : "checkmark-circle"}
              size={24}
              color={bill.isPaid ? theme.colors.textPrimary : "#FFFFFF"}
            />
            <Text style={[styles.actionButtonText, bill.isPaid && styles.actionButtonTextSecondary]}>
              {bill.isPaid ? 'إلغاء حالة الدفع' : 'تسجيل الدفع الآن'}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', gap: 12 }}>
            <TouchableOpacity
              onPress={handleEdit}
              activeOpacity={0.8}
              style={[styles.actionButton, styles.actionButtonSecondary, { flex: 1 }]}
            >
              <Ionicons name="pencil" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.actionButtonTextSecondary}>تعديل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              activeOpacity={0.8}
              style={[styles.actionButton, styles.actionButtonDanger, { flex: 1 }]}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>حذف</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ConfirmAlert
        visible={showDeleteAlert}
        title="حذف الفاتورة"
        message={`هل أنت متأكد من حذف الفاتورة "${bill.title}"؟`}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteAlert(false)}
      />

      {/* Full Screen Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <Pressable
          style={styles.imageModalOverlay}
          onPress={() => setShowImageModal(false)}
        >
          <View style={styles.imageModalContent}>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={() => setShowImageModal(false)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {bill?.image_path && (
              <Image
                source={{ uri: bill.image_path }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slightly cooler background
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
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: theme.colors.surfaceCard,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 15 }
      : { elevation: 4 }),
  },
  headerGradient: {
    padding: 24,
  },
  headerTop: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  categoryIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 16,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  billTitle: {
    fontSize: 22,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  billCategory: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('500'),
    fontFamily: theme.typography.fontFamily,
  },
  amountSection: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  amountLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: getPlatformFontWeight('900'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  amountValuePaid: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  paidBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
  },
  paidText: {
    fontSize: 13,
    color: '#065F46',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  imageContainer: {
    marginTop: 24,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    height: 200,
    ...getPlatformShadow('sm'),
  },
  billImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  fullScreenImage: {
    width: width,
    height: '100%',
  },
  detailsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 }
      : { elevation: 2 }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 20,
    textAlign: isRTL ? 'right' : 'left',
  },
  detailRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    marginBottom: 20,
    alignItems: 'center',
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
    marginHorizontal: 16,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 6,
  },
  statusBadgeOverdue: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeDueSoon: {
    backgroundColor: '#FFFBEB',
  },
  statusText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  paymentsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 }
      : { elevation: 2 }),
  },
  paymentRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '40',
  },
  paymentInfo: {
    flex: 1,
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  paymentDate: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: getPlatformFontWeight('600'),
    fontFamily: theme.typography.fontFamily,
    marginBottom: 2,
  },
  paymentDescription: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily,
  },
  paymentAmount: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('800'),
    color: '#10B981',
    fontFamily: theme.typography.fontFamily,
  },
  totalPaidRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border + '80',
    borderStyle: 'dashed',
  },
  totalPaidLabel: {
    fontSize: 15,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  totalPaidAmount: {
    fontSize: 18,
    fontWeight: getPlatformFontWeight('900'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    gap: 10,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 }
      : { elevation: 3 }),
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: theme.colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  actionButtonDanger: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  actionButtonTextSecondary: {
    color: theme.colors.textPrimary,
  },
});
