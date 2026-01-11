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
import { theme } from '../utils/theme';
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
        setImageUri(uri);
        setProcessing(true);
        setScannedData(null);
        setShowManualInput(false);

        try {
          // استخدام OCR لتحليل الصورة تلقائياً
          const data = await processReceiptImage(uri);
          setScannedData(data);
          
          // إذا لم يتم استخراج بيانات كافية، نعرض خيار إدخال النص يدوياً
          if (!data.amount && !data.title) {
            alertService.info(
              'تنبيه',
              'لم يتم استخراج بيانات كافية من الصورة. يمكنك إدخال النص يدوياً.'
            );
            setShowManualInput(true);
          } else {
            alertService.success('نجح', 'تم استخراج البيانات من الفاتورة بنجاح');
          }
        } catch (error) {
          console.error('Error processing receipt:', error);
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
                <Ionicons name="camera-outline" size={64} color={theme.colors.textMuted} />
                <Text style={styles.emptyStateText}>
                  اختر صورة الفاتورة أو أدخل النص يدوياً
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
                    >
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                      <Text style={styles.selectButtonText}>صورة</Text>
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
                    >
                      <Ionicons name="text" size={20} color="#FFFFFF" />
                      <Text style={styles.selectButtonText}>نص</Text>
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
                    <View style={styles.sectionHeader}>
                      <LinearGradient
                        colors={theme.gradients.primary as any}
                        style={styles.sectionHeaderGradient}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.sectionHeaderText}>البيانات المستخرجة</Text>
                      </LinearGradient>
                    </View>

                    <View style={styles.dataCard}>
                      {scannedData.title && (
                        <View style={styles.dataItem}>
                          <View style={styles.dataItemIcon}>
                            <Ionicons name="document-text" size={20} color={theme.colors.primary} />
                          </View>
                          <View style={styles.dataItemContent}>
                            <Text style={styles.dataItemLabel}>العنوان</Text>
                            <Text style={styles.dataItemValue}>{scannedData.title}</Text>
                          </View>
                        </View>
                      )}
                      
                      {scannedData.amount && (
                        <View style={styles.dataItem}>
                          <View style={[styles.dataItemIcon, { backgroundColor: '#10B98120' }]}>
                            <Ionicons name="cash" size={20} color="#10B981" />
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
                          <View style={[styles.dataItemIcon, { backgroundColor: '#3B82F620' }]}>
                            <Ionicons name="calendar" size={20} color="#3B82F6" />
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
                          <View style={[styles.dataItemIcon, { backgroundColor: '#8B5CF620' }]}>
                            <Ionicons name="pricetag" size={20} color="#8B5CF6" />
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

                    <View style={styles.infoBanner}>
                      <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
                      <Text style={styles.infoBannerText}>
                        يمكنك تعديل البيانات قبل الحفظ
                      </Text>
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
                  style={styles.changeImageButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={20} color={theme.colors.primary} />
                  <Text style={styles.changeImageText}>رجوع</Text>
                </TouchableOpacity>
                {scannedData && (
                  <TouchableOpacity
                    onPress={handleUseData}
                    style={styles.useButton}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={theme.gradients.primary as any}
                      style={styles.useButtonGradient}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.useButtonText}>استخدام البيانات</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            ) : imageUri && !processing ? (
              <>
                <TouchableOpacity
                  onPress={() => setShowManualInput(true)}
                  style={styles.changeImageButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="text" size={20} color={theme.colors.primary} />
                  <Text style={styles.changeImageText}>إدخال نص</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={showImageSourceOptions}
                  style={styles.changeImageButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={20} color={theme.colors.primary} />
                  <Text style={styles.changeImageText}>تغيير الصورة</Text>
                </TouchableOpacity>
                
                {scannedData && (
                  <TouchableOpacity
                    onPress={handleUseData}
                    style={styles.useButton}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={theme.gradients.primary as any}
                      style={styles.useButtonGradient}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.useButtonText}>استخدام البيانات</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
            
            <TouchableOpacity
              onPress={handleClose}
              style={styles.cancelButton}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>إلغاء</Text>
            </TouchableOpacity>
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
    fontWeight: '700',
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
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginHorizontal: theme.spacing.xl,
  },
  selectButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
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
    fontWeight: '700',
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
    ...theme.shadows.md,
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  processingText: {
    fontSize: theme.typography.sizes.md,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: '600',
    marginTop: theme.spacing.sm,
  },
  extractedDataSection: {
    paddingHorizontal: theme.spacing.lg,
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.sm,
  },
  sectionHeaderGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionHeaderText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  dataCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.md,
    marginBottom: theme.spacing.md,
  },
  dataItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dataItemIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : theme.spacing.md,
    marginLeft: isRTL ? theme.spacing.md : 0,
  },
  dataItemContent: {
    flex: 1,
  },
  dataItemLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  dataItemValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  amountValue: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.primary,
  },
  infoBanner: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: isRTL ? 0 : 3,
    borderRightWidth: isRTL ? 3 : 0,
    borderColor: theme.colors.primary,
  },
  infoBannerText: {
    flex: 1,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '500',
  },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  changeImageButton: {
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
  changeImageText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  useButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  useButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  useButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
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
    fontWeight: '600',
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
    ...theme.shadows.md,
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
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
