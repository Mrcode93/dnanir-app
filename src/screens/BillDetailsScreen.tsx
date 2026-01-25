import React, { useState, useEffect, useLayoutEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
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
import { isRTL } from '../utils/rtl';
import { alertService } from '../services/alertService';
import { ConfirmAlert } from '../components/ConfirmAlert';

const { width } = Dimensions.get('window');

export const BillDetailsScreen = ({ navigation, route }: any) => {
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
      <SafeAreaView style={styles.container} edges={['top']}>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تفاصيل الفاتورة</Text>
        <View style={styles.headerRight} />
      </View>

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
              ? ['#FEE2E2', theme.colors.surfaceCard]
              : isDueSoon
              ? ['#FEF3C7', theme.colors.surfaceCard]
              : [theme.colors.surfaceCard, theme.colors.surfaceLight]
            }
            style={styles.headerGradient}
          >
            <View style={styles.headerTop}>
              <View style={[styles.categoryIconBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                <Ionicons
                  name={categoryInfo.icon as any}
                  size={32}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.billTitle}>{bill.title}</Text>
                <Text style={styles.billCategory}>{categoryInfo.label}</Text>
              </View>
            </View>
            
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>المبلغ</Text>
              <Text style={[styles.amountValue, bill.isPaid && styles.amountValuePaid]}>
                {formatCurrency(bill.amount)}
              </Text>
              {bill.isPaid && (
                <View style={styles.paidBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.paidText}>مدفوعة</Text>
                </View>
              )}
            </View>

            {bill.image_path && (
              <TouchableOpacity 
                style={styles.imageContainer}
                onPress={() => setShowImageModal(true)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: bill.image_path }} style={styles.billImage} />
                <View style={styles.imageOverlay}>
                  <Ionicons name="expand" size={24} color="#FFFFFF" />
                  <Text style={styles.imageOverlayText}>اضغط للعرض</Text>
                </View>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>تفاصيل الفاتورة</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
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
                  <Text style={styles.statusText}>
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
              <View style={styles.detailIcon}>
                <Ionicons name="repeat" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>نوع التكرار</Text>
                <Text style={styles.detailValue}>
                  {bill.recurrenceType === 'monthly' ? 'شهري' :
                   bill.recurrenceType === 'weekly' ? 'أسبوعي' :
                   bill.recurrenceType === 'quarterly' ? 'ربع سنوي' : 'سنوي'}
                </Text>
              </View>
            </View>
          )}

          {bill.description && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="document-text" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>ملاحظات</Text>
                <Text style={styles.detailValue}>{bill.description}</Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="notifications" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>التذكير قبل</Text>
              <Text style={styles.detailValue}>{bill.reminderDaysBefore} أيام</Text>
            </View>
          </View>
        </View>

        {/* Payment History */}
        {payments.length > 0 && (
          <View style={styles.paymentsCard}>
            <Text style={styles.sectionTitle}>سجل الدفعات</Text>
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
              <Text style={styles.totalPaidLabel}>إجمالي المدفوع</Text>
              <Text style={styles.totalPaidAmount}>{formatCurrency(totalPaid)}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={handleTogglePaid}
            style={[styles.actionButton, bill.isPaid ? styles.actionButtonSecondary : styles.actionButtonPrimary]}
          >
            <Ionicons
              name={bill.isPaid ? "checkmark-circle" : "checkmark-circle-outline"}
              size={24}
              color={bill.isPaid ? theme.colors.textPrimary : "#FFFFFF"}
            />
            <Text style={[styles.actionButtonText, bill.isPaid && styles.actionButtonTextSecondary]}>
              {bill.isPaid ? 'تم الدفع' : 'تسجيل الدفع'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEdit}
            style={[styles.actionButton, styles.actionButtonSecondary]}
          >
            <Ionicons name="create-outline" size={24} color={theme.colors.textPrimary} />
            <Text style={styles.actionButtonTextSecondary}>تعديل</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            style={[styles.actionButton, styles.actionButtonDanger]}
          >
            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>حذف</Text>
          </TouchableOpacity>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
   
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...getPlatformShadow('sm'),
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
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
    direction: 'rtl',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    ...getPlatformShadow('md'),
  },
  headerGradient: {
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  billTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  billCategory: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  amountSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  amountLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
  },
  amountValue: {
    fontSize: theme.typography.sizes.display,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  amountValuePaid: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  paidText: {
    fontSize: theme.typography.sizes.sm,
    color: '#10B981',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  imageContainer: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  billImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
    marginTop: 8,
    fontWeight: getPlatformFontWeight('600'),
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullScreenImage: {
    width: width,
    height: '100%',
  },
  detailsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...getPlatformShadow('sm'),
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '20',
    marginTop: 4,
  },
  statusBadgeOverdue: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeDueSoon: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  paymentsCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...getPlatformShadow('sm'),
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDate: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 4,
  },
  paymentDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  paymentAmount: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  totalPaidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: theme.colors.border,
  },
  totalPaidLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  totalPaidAmount: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    ...getPlatformShadow('sm'),
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionButtonDanger: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  actionButtonTextSecondary: {
    color: theme.colors.textPrimary,
  },
});
