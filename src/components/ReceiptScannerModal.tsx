import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import {
  requestImagePermissions,
  pickImageFromLibrary,
  takePhotoWithCamera,
  processReceiptImage,
  parseReceiptText,
  ReceiptData,
} from '../services/receiptOCRService';
import { alertService } from '../services/alertService';
import { EXPENSE_CATEGORIES, ExpenseCategory } from '../types';
import { authApiService } from '../services/authApiService';

interface ReceiptScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onReceiptScanned: (data: ReceiptData) => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  visible,
  onClose,
  onReceiptScanned,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [scannedData, setScannedData] = useState<ReceiptData | null>(null);
  const [manualText, setManualText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const handlePickImage = async (source: 'camera' | 'library') => {
    try {
      const hasPermission = await requestImagePermissions();
      if (!hasPermission) {
        alertService.warning(
          'إذن مطلوب',
          'يرجى السماح بالوصول إلى الكاميرا والمكتبة من إعدادات التطبيق'
        );
        return;
      }

      let uri: string | null = null;
      if (source === 'camera') {
        uri = await takePhotoWithCamera();
      } else {
        uri = await pickImageFromLibrary();
      }

      if (uri) {
        console.log('📷 Image picked, URI:', uri);
        setImageUri(uri);
        setProcessing(true);
        setScannedData(null);
        setShowManualInput(false);

        try {
          // استخدام OCR لتحليل الصورة تلقائياً
          console.log('🔄 Starting receipt processing...');
          
          // Check if user is authenticated for better UX
          const isAuthenticated = await authApiService.isAuthenticated();
          if (!isAuthenticated) {
            alertService.info(
              'ملاحظة',
              'أنت غير مسجل دخول. سيتم استخدام OCR المحلي. للتجربة الأفضل، يرجى تسجيل الدخول لاستخدام OCR السيرفر.'
            );
          }
          
          const data = await processReceiptImage(uri);
          console.log('✅ Receipt processing completed, data:', data);
          setScannedData(data);
          
          // إذا لم يتم استخراج بيانات كافية، نعرض خيار إدخال النص يدوياً
          if (!data.amount && !data.title) {
            alertService.info(
              'تنبيه',
              'لم يتم استخراج بيانات كافية من الصورة. يمكنك إدخال النص يدوياً.'
            );
            setShowManualInput(true);
          } else {
            // Success message is now shown in the UI, no need for alert
            console.log('✅ Receipt data extracted successfully');
          }
        } catch (error) {
          console.error('❌ Error processing receipt:', error);
          alertService.error('خطأ', 'فشل معالجة الفاتورة. يمكنك إدخال النص يدوياً.');
          setShowManualInput(true);
        } finally {
          setProcessing(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء اختيار الصورة');
    }
  };

  const handleUseData = () => {
    if (scannedData) {
      onReceiptScanned(scannedData);
      handleClose();
    }
  };

  const handleClose = () => {
    setImageUri(null);
    setScannedData(null);
    setProcessing(false);
    setManualText('');
    setShowManualInput(false);
    onClose();
  };

  const handleProcessManualText = () => {
    if (!manualText.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال نص الفاتورة');
      return;
    }

    try {
      const data = parseReceiptText(manualText);
      setScannedData(data);
      setShowManualInput(false);
      alertService.success('نجح', 'تم تحليل الفاتورة بنجاح');
    } catch (error) {
      console.error('Error parsing text:', error);
      alertService.error('خطأ', 'فشل تحليل النص');
    }
  };

  const showImageSourceOptions = () => {
    Alert.alert(
      'اختر المصدر',
      'من أين تريد اختيار صورة الفاتورة؟',
      [
        {
          text: 'الكاميرا',
          onPress: () => handlePickImage('camera'),
        },
        {
          text: 'المكتبة',
          onPress: () => handlePickImage('library'),
        },
        {
          text: 'إلغاء',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
    >
      <LinearGradient
        colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
        style={styles.modalContainer}
      >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}>
                <Ionicons name="receipt" size={24} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>قراءة الفاتورة</Text>
                <Text style={styles.subtitle}>التقط أو اختر صورة الفاتورة</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {showManualInput ? (
              <View style={styles.manualInputContainer}>
                <Text style={styles.manualInputLabel}>
                  أدخل نص الفاتورة (سيتم استخراج المبلغ والتاريخ تلقائياً)
                </Text>
                <TextInput
                  style={styles.manualInput}
                  value={manualText}
                  onChangeText={setManualText}
                  placeholder="الصق أو اكتب نص الفاتورة هنا..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  onPress={handleProcessManualText}
                  style={styles.processButton}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.processButtonGradient}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.processButtonText}>تحليل النص</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : !imageUri ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconContainer}>
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.emptyStateIconGradient}
                  >
                    <Ionicons name="receipt-outline" size={48} color="#FFFFFF" />
                  </LinearGradient>
                </View>
                <Text style={styles.emptyStateTitle}>مسح الفاتورة</Text>
                <Text style={styles.emptyStateText}>
                  استخدم الكاميرا لالتقاط صورة الفاتورة أو أدخل النص يدوياً
                </Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    onPress={showImageSourceOptions}
                    style={[styles.selectButton, { flex: 1, marginRight: theme.spacing.sm }]}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={theme.gradients.primary as any}
                      style={styles.selectButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="camera" size={22} color="#FFFFFF" />
                      <Text style={styles.selectButtonText}>التقاط صورة</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowManualInput(true)}
                    style={[styles.selectButton, { flex: 1, marginLeft: theme.spacing.sm }]}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#7C3AED']}
                      style={styles.selectButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="text" size={22} color="#FFFFFF" />
                      <Text style={styles.selectButtonText}>إدخال نص</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView 
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Image Section */}
                <View style={styles.imageSection}>
                  <View style={styles.imageWrapper}>
                    <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
                    {processing && (
                      <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                        <Text style={styles.processingText}>جاري معالجة الفاتورة...</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Extracted Data Section */}
                {scannedData && !processing && (
                  <View style={styles.extractedDataSection}>
                    {/* Success Header */}
                    <View style={styles.successHeader}>
                      <View style={styles.successIconContainer}>
                        <LinearGradient
                          colors={['#10B981', '#059669']}
                          style={styles.successIconGradient}
                        >
                          <Ionicons name="checkmark" size={28} color="#FFFFFF" />
                        </LinearGradient>
                      </View>
                      <View style={styles.successTextContainer}>
                        <Text style={styles.successTitle}>تم استخراج البيانات بنجاح</Text>
                        <Text style={styles.successSubtitle}>تم تحليل الفاتورة باستخدام الذكاء الاصطناعي</Text>
                      </View>
                    </View>

                    {/* Data Card */}
                    <View style={styles.dataCard}>
                      {scannedData.title && (
                        <View style={styles.dataItem}>
                          <View style={styles.dataItemIcon}>
                            <Ionicons name="document-text-outline" size={22} color={theme.colors.primary} />
                          </View>
                          <View style={styles.dataItemContent}>
                            <Text style={styles.dataItemLabel}>العنوان</Text>
                            <Text style={styles.dataItemValue} numberOfLines={2}>{scannedData.title}</Text>
                          </View>
                        </View>
                      )}
                      
                      {scannedData.amount && (
                        <View style={[styles.dataItem, styles.dataItemHighlight]}>
                          <View style={[styles.dataItemIcon, styles.amountIcon]}>
                            <LinearGradient
                              colors={['#10B981', '#059669']}
                              style={styles.amountIconGradient}
                            >
                              <Ionicons name="cash" size={22} color="#FFFFFF" />
                            </LinearGradient>
                          </View>
                          <View style={styles.dataItemContent}>
                            <Text style={styles.dataItemLabel}>المبلغ</Text>
                            <Text style={[styles.dataItemValue, styles.amountValue]}>
                              {scannedData.amount.toLocaleString()} د.ع
                            </Text>
                          </View>
                        </View>
                      )}
                      
                      {scannedData.date && (
                        <View style={styles.dataItem}>
                          <View style={[styles.dataItemIcon, { backgroundColor: '#3B82F615' }]}>
                            <Ionicons name="calendar-outline" size={22} color="#3B82F6" />
                          </View>
                          <View style={styles.dataItemContent}>
                            <Text style={styles.dataItemLabel}>التاريخ</Text>
                            <Text style={styles.dataItemValue}>
                              {scannedData.date.toLocaleDateString('ar-IQ', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                        </View>
                      )}
                      
                      {scannedData.category && (
                        <View style={styles.dataItem}>
                          <View style={[styles.dataItemIcon, { backgroundColor: '#8B5CF615' }]}>
                            <Ionicons name="pricetag-outline" size={22} color="#8B5CF6" />
                          </View>
                          <View style={styles.dataItemContent}>
                            <Text style={styles.dataItemLabel}>الفئة</Text>
                            <Text style={styles.dataItemValue}>
                              {EXPENSE_CATEGORIES[scannedData.category as ExpenseCategory] || scannedData.category}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Action Banner */}
                    <View style={styles.actionBanner}>
                      <View style={styles.actionBannerContent}>
                        <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
                        <Text style={styles.actionBannerText}>
                          البيانات جاهزة للحفظ. اضغط على "حفظ البيانات" لإضافتها للمصروف
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {showManualInput ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setShowManualInput(false);
                    setManualText('');
                    if (!imageUri) {
                      setScannedData(null);
                    }
                  }}
                  style={styles.secondaryButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={20} color={theme.colors.textSecondary} />
                  <Text style={styles.secondaryButtonText}>رجوع</Text>
                </TouchableOpacity>
                {scannedData && (
                  <TouchableOpacity
                    onPress={handleUseData}
                    style={styles.saveButton}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.saveButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>حفظ البيانات</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            ) : imageUri && !processing ? (
              <>
                {scannedData ? (
                  <>
                    <TouchableOpacity
                      onPress={showImageSourceOptions}
                      style={styles.secondaryButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh" size={20} color={theme.colors.textSecondary} />
                      <Text style={styles.secondaryButtonText}>إعادة المسح</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleUseData}
                      style={styles.saveButton}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        style={styles.saveButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
                        <Text style={styles.saveButtonText}>حفظ البيانات</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => setShowManualInput(true)}
                      style={styles.secondaryButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="text" size={20} color={theme.colors.textSecondary} />
                      <Text style={styles.secondaryButtonText}>إدخال نص</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={showImageSourceOptions}
                      style={styles.secondaryButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="refresh" size={20} color={theme.colors.textSecondary} />
                      <Text style={styles.secondaryButtonText}>تغيير الصورة</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : null}
            
            {!scannedData && (
              <TouchableOpacity
                onPress={handleClose}
                style={styles.cancelButton}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    minHeight: 250,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyStateIconContainer: {
    marginBottom: theme.spacing.md,
  },
  emptyStateIconGradient: {
    width: 120,
    height: 120,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('lg'),
  },
  emptyStateTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.md,
  },
  selectButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  selectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  selectButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.lg,
  },
  imageSection: {
    marginBottom: theme.spacing.lg,
  },
  imageWrapper: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceLight,
    ...getPlatformShadow('md'),
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 350,
    backgroundColor: '#F9FAFB',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  processingText: {
    fontSize: theme.typography.sizes.md,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    marginTop: theme.spacing.sm,
  },
  extractedDataSection: {
    paddingHorizontal: theme.spacing.lg,
  },
  successHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: '#10B98110',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#10B98130',
  },
  successIconContainer: {
    marginRight: isRTL ? 0 : theme.spacing.md,
    marginLeft: isRTL ? theme.spacing.md : 0,
  },
  successIconGradient: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('md'),
  },
  successTextContainer: {
    flex: 1,
  },
  successTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#10B981',
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
  },
  successSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  dataCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...getPlatformShadow('lg'),
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dataItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    marginBottom: theme.spacing.sm,
  },
  dataItemHighlight: {
    backgroundColor: '#10B98110',
    borderWidth: 1.5,
    borderColor: '#10B98130',
  },
  dataItemIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : theme.spacing.md,
    marginLeft: isRTL ? theme.spacing.md : 0,
  },
  amountIcon: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  amountIconGradient: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataItemContent: {
    flex: 1,
  },
  dataItemLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    fontWeight: getPlatformFontWeight('600'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataItemValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  amountValue: {
    fontSize: theme.typography.sizes.xl,
    color: '#10B981',
    fontWeight: getPlatformFontWeight('800'),
  },
  actionBanner: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  actionBannerContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight + '15',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  actionBannerText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
    lineHeight: 20,
  },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceCard,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
    minWidth: 100,
  },
  secondaryButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('lg'),
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md + 2,
    gap: theme.spacing.sm,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('800'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    letterSpacing: 0.5,
  },
  cancelButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    minWidth: 80,
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  buttonRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    width: '100%',
    marginTop: theme.spacing.md,
  },
  manualInputContainer: {
    width: '100%',
    gap: theme.spacing.md,
  },
  manualInputLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  manualInput: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    minHeight: 200,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexShrink: 0,
  },
  processButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  processButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  processButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
