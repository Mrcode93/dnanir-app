import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Switch,
  Image,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Bill, BillCategory, BILL_CATEGORIES } from '../types';
import { addBill, updateBill } from '../database/database';
import { scheduleBillReminder } from '../services/billService';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { requestImagePermissions, pickImageFromLibrary, takePhotoWithCamera } from '../services/receiptOCRService';
import { convertArabicToEnglish } from '../utils/numbers';

interface AddBillScreenProps {
  navigation: any;
  route: any;
}

export const AddBillScreen: React.FC<AddBillScreenProps> = ({
  navigation,
  route,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, currency } = useCurrency();
  const bill = route?.params?.bill as Bill | undefined;
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BillCategory>('utilities');
  const [dueDate, setDueDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'monthly' | 'yearly' | 'quarterly' | 'weekly'>('monthly');
  const [reminderDaysBefore, setReminderDaysBefore] = useState('3');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);

  useEffect(() => {
    if (bill) {
      setTitle(bill.title);
      setAmount(bill.amount.toString());
      setCategory(bill.category as BillCategory);
      setDueDate(new Date(bill.dueDate));
      setDescription(bill.description || '');
      setHasRecurrence(!!bill.recurrenceType);
      setRecurrenceType(bill.recurrenceType || 'monthly');
      setReminderDaysBefore(bill.reminderDaysBefore.toString());
      setImageUri(bill.image_path || null);
    } else {
      resetForm();
    }
  }, [bill]);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('utilities');
    setDueDate(new Date());
    setDescription('');
    setHasRecurrence(false);
    setRecurrenceType('monthly');
    setReminderDaysBefore('3');
    setImageUri(null);
  };

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
        // Save image to app's document directory
        const fileName = `bill_${Date.now()}.jpg`;
        const documentDir = FileSystem.documentDirectory || '';
        const fileUri = `${documentDir}${fileName}`;
        await FileSystem.copyAsync({
          from: uri,
          to: fileUri,
        });
        setImageUri(fileUri);
        setShowImagePicker(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء اختيار الصورة');
    }
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'حذف الصورة',
      'هل تريد حذف هذه الصورة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            if (imageUri) {
              // Delete file if it exists
              FileSystem.deleteAsync(imageUri, { idempotent: true }).catch(() => { });
            }
            setImageUri(null);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال عنوان الفاتورة');
      return;
    }

    Keyboard.dismiss();

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    if (!reminderDaysBefore.trim() || isNaN(Number(reminderDaysBefore)) || Number(reminderDaysBefore) < 0) {
      alertService.warning('تنبيه', 'يرجى إدخال عدد أيام التذكير صحيح');
      return;
    }

    setLoading(true);

    try {
      const billData = {
        title: title.trim(),
        amount: Number(amount),
        category: category,
        dueDate: dueDate.toISOString().split('T')[0],
        recurrenceType: hasRecurrence ? recurrenceType : undefined,
        recurrenceValue: hasRecurrence ? 1 : undefined,
        description: description.trim() || undefined,
        currency: currencyCode,
        isPaid: bill?.isPaid || false,
        paidDate: bill?.paidDate,
        reminderDaysBefore: Number(reminderDaysBefore),
        image_path: imageUri || undefined,
      };

      if (bill) {
        await updateBill(bill.id, billData);
        alertService.success('نجح', 'تم تحديث الفاتورة بنجاح');
      } else {
        const billId = await addBill(billData);
        // Schedule reminder for new bills
        await scheduleBillReminder(billId);
        alertService.success('نجح', 'تم إضافة الفاتورة بنجاح');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving bill:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const getCategoryInfo = (cat: BillCategory) => {
    return BILL_CATEGORIES[cat];
  };

  const categoryIcons: Record<BillCategory, string> = {
    utilities: 'flash',
    rent: 'home',
    insurance: 'shield',
    internet: 'wifi',
    phone: 'call',
    subscription: 'card',
    loan: 'document',
    other: 'ellipse',
  };

  const categoryColors: Record<BillCategory, string[]> = {
    utilities: ['#EF4444', '#DC2626'],
    rent: ['#3B82F6', '#2563EB'],
    insurance: ['#10B981', '#059669'],
    internet: ['#8B5CF6', '#7C3AED'],
    phone: ['#F59E0B', '#D97706'],
    subscription: ['#EC4899', '#DB2777'],
    loan: ['#06B6D4', '#0891B2'],
    other: ['#6B7280', '#4B5563'],
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBadge, { backgroundColor: categoryColors[category][0] + '20' }]}>
                <Ionicons
                  name={categoryIcons[category] as any}
                  size={24}
                  color={categoryColors[category][0]}
                />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>
                  {bill ? 'تعديل الفاتورة' : 'فاتورة جديدة'}
                </Text>
                <Text style={styles.subtitle}>أضف تفاصيل الفاتورة</Text>
              </View>
            </View>
            <IconButton
              icon="close"
              size={24}
              onPress={handleClose}
              iconColor={theme.colors.textSecondary}
              style={styles.closeButton}
            />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>عنوان الفاتورة *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: فاتورة الكهرباء"
                mode="outlined"
                style={styles.input}
                contentStyle={styles.inputContent}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>المبلغ *</Text>
              <TextInput
                value={amount}
                onChangeText={(val) => setAmount(convertArabicToEnglish(val))}
                placeholder="0"
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
                contentStyle={styles.inputContent}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
                right={
                  <TextInput.Affix text={currency?.symbol || currencyCode} />
                }
              />
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>الفئة *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {Object.keys(BILL_CATEGORIES).map((cat) => {
                  const billCat = cat as BillCategory;
                  const isSelected = category === billCat;
                  return (
                    <Pressable
                      key={billCat}
                      onPress={() => setCategory(billCat)}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                        isSelected && { backgroundColor: categoryColors[billCat][0] },
                      ]}
                    >
                      <Ionicons
                        name={categoryIcons[billCat] as any}
                        size={20}
                        color={isSelected ? '#FFFFFF' : categoryColors[billCat][0]}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {getCategoryInfo(billCat).label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Due Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>تاريخ الاستحقاق *</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
              >
                <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                <Text style={styles.dateButtonText}>
                  {dueDate.toLocaleDateString('ar-IQ', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setDueDate(selectedDate);
                    }
                  }}
                />
              )}
            </View>

            {/* Recurrence */}
            <View style={styles.inputGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>فاتورة متكررة</Text>
                <Switch
                  value={hasRecurrence}
                  onValueChange={setHasRecurrence}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                  thumbColor={hasRecurrence ? theme.colors.primary : theme.colors.textSecondary}
                />
              </View>
              {hasRecurrence && (
                <Pressable
                  onPress={() => {
                    const types: ('monthly' | 'yearly' | 'quarterly' | 'weekly')[] = ['monthly', 'weekly', 'quarterly', 'yearly'];
                    const currentIndex = types.indexOf(recurrenceType);
                    const nextIndex = (currentIndex + 1) % types.length;
                    setRecurrenceType(types[nextIndex]);
                  }}
                  style={styles.recurrenceButton}
                >
                  <Text style={styles.recurrenceButtonText}>
                    {recurrenceType === 'monthly' ? 'شهري' :
                      recurrenceType === 'weekly' ? 'أسبوعي' :
                        recurrenceType === 'quarterly' ? 'ربع سنوي' : 'سنوي'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Reminder Days */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>التذكير قبل (أيام)</Text>
              <TextInput
                value={reminderDaysBefore}
                onChangeText={(val) => setReminderDaysBefore(convertArabicToEnglish(val))}
                placeholder="3"
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
                contentStyle={styles.inputContent}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>ملاحظات</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="ملاحظات إضافية..."
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.input}
                contentStyle={styles.inputContent}
                outlineColor={theme.colors.border}
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            {/* Bill Image */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>صورة الفاتورة</Text>
              {imageUri ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUri }} style={styles.billImage} />
                  <TouchableOpacity
                    onPress={handleRemoveImage}
                    style={styles.removeImageButton}
                  >
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.imagePickerContainer}>
                  <TouchableOpacity
                    onPress={() => setShowImagePicker(true)}
                    style={styles.imagePickerButton}
                  >
                    <Ionicons name="camera" size={32} color={theme.colors.primary} />
                    <Text style={styles.imagePickerText}>إضافة صورة الفاتورة</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Image Picker Options Modal */}
            {showImagePicker && (
              <View style={styles.imagePickerModal}>
                <View style={styles.imagePickerModalContent}>
                  <Text style={styles.imagePickerModalTitle}>اختر مصدر الصورة</Text>
                  <View style={styles.imagePickerOptions}>
                    <TouchableOpacity
                      onPress={() => handlePickImage('camera')}
                      style={styles.imagePickerOption}
                    >
                      <Ionicons name="camera" size={32} color={theme.colors.primary} />
                      <Text style={styles.imagePickerOptionText}>التقاط صورة</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handlePickImage('library')}
                      style={styles.imagePickerOption}
                    >
                      <Ionicons name="images" size={32} color={theme.colors.primary} />
                      <Text style={styles.imagePickerOptionText}>من المكتبة</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowImagePicker(false)}
                    style={styles.imagePickerCancelButton}
                  >
                    <Text style={styles.imagePickerCancelText}>إلغاء</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={loading}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            >
              <LinearGradient
                colors={[theme.colors.primary, theme.colors.primaryDark]}
                style={styles.saveButtonGradient}
              >
                {loading ? (
                  <Text style={styles.saveButtonText}>جاري الحفظ...</Text>
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>
                      {bill ? 'تحديث' : 'حفظ'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    direction: 'rtl',
  },
  keyboardView: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginLeft: 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 4,
  },
  closeButton: {
    margin: 0,
  },
  scrollView: {
    flex: 1,
    direction: 'rtl',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 8,
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
  },
  inputContent: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceLight,
    marginRight: isRTL ? 0 : 8,
    marginLeft: isRTL ? 8 : 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryChipSelected: {
    borderColor: 'transparent',
  },
  categoryChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginLeft: isRTL ? 0 : 8,
    marginRight: isRTL ? 8 : 0,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: getPlatformFontWeight('600'),
  },
  dateButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceLight,
    padding: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
  },
  switchRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurrenceButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceLight,
    padding: 12,
    marginTop: 8,
  },
  recurrenceButtonText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
  imageContainer: {
    position: 'relative',
    marginTop: 8,
  },
  billImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  imagePickerContainer: {
    marginTop: 8,
  },
  imagePickerButton: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
  },
  imagePickerText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 8,
  },
  imagePickerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imagePickerModalContent: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    width: '80%',
    maxWidth: 400,
  },
  imagePickerModalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: 'center',
  },
  imagePickerOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  imagePickerOption: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    minWidth: 100,
  },
  imagePickerOptionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 8,
  },
  imagePickerCancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  imagePickerCancelText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
});
