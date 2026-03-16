import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  Image,
  Keyboard,
  StatusBar,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { CustomDatePicker } from '../components/CustomDatePicker';
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
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { ScreenContainer, AppHeader, AppButton, AppBottomSheet } from '../design-system';

interface AddBillScreenProps {
  navigation: any;
  route: any;
}

export const AddBillScreen: React.FC<AddBillScreenProps> = ({ navigation, route }) => {
  const { theme, isDark } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, currency: currencyObj } = useCurrency();
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
      setAmount(formatNumberWithCommas(bill.amount));
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

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const handlePickImage = async (source: 'camera' | 'library') => {
    try {
      const hasPermission = await requestImagePermissions();
      if (!hasPermission) {
        alertService.warning('إذن مطلوب', 'يرجى السماح بالوصول إلى الكاميرا والمكتبة من إعدادات التطبيق');
        return;
      }
      let uri: string | null = null;
      if (source === 'camera') {
        uri = await takePhotoWithCamera();
      } else {
        uri = await pickImageFromLibrary();
      }
      if (uri) {
        const fileName = `bill_${Date.now()}.jpg`;
        const documentDir = FileSystem.documentDirectory || '';
        const fileUri = `${documentDir}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: fileUri });
        setImageUri(fileUri);
        setShowImagePicker(false);
      }
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء اختيار الصورة');
    }
  };

  const handleRemoveImage = () => {
    alertService.confirm('حذف الصورة', 'هل تريد حذف هذه الصورة؟', () => {
      if (imageUri) {
        FileSystem.deleteAsync(imageUri, { idempotent: true }).catch(() => { });
      }
      setImageUri(null);
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال عنوان الفاتورة');
      return;
    }
    Keyboard.dismiss();
    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount.trim() || isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }
    setLoading(true);
    try {
      const billData = {
        title: title.trim(),
        amount: Number(cleanAmount),
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
        alertService.toastSuccess('تم تحديث الفاتورة بنجاح');
      } else {
        const billId = await addBill(billData);
        await scheduleBillReminder(billId);
        alertService.toastSuccess('تم إضافة الفاتورة بنجاح');
      }
      handleClose();
    } catch (error) {
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const categoryInfo = BILL_CATEGORIES[category];

  const recurrenceLabels: Record<string, string> = {
    monthly: 'شهري',
    weekly: 'أسبوعي',
    quarterly: 'ربع سنوي',
    yearly: 'سنوي',
  };

  const saveFooter = (
    <AppButton
      label={loading ? 'جاري الحفظ...' : bill ? 'تحديث الفاتورة' : 'حفظ الفاتورة'}
      onPress={handleSave}
      variant="primary"
      size="lg"
      loading={loading}
      disabled={loading}
      rightIcon="checkmark-circle"
      style={{ backgroundColor: categoryInfo.color }}
    />
  );

  return (
    <ScreenContainer
      scrollable
      footer={saveFooter}
      edges={['top']}
      style={{ backgroundColor: theme.colors.background }}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <AppHeader
        title={bill ? 'تعديل فاتورة' : 'فاتورة جديدة'}
        backIcon="close"
        onBack={handleClose}
      />

      {/* Amount Section */}
      <View style={styles.amountSection}>
        <Text style={styles.currencySymbol}>{currencyObj?.symbol || currencyCode}</Text>
        <TextInput
          value={amount}
          onChangeText={(v) => {
            const cleaned = convertArabicToEnglish(v);
            setAmount(formatNumberWithCommas(cleaned));
          }}
          placeholder="0"
          placeholderTextColor={theme.colors.textMuted + '80'}
          style={styles.amountInput}
          keyboardType="decimal-pad"
          selectionColor={categoryInfo.color}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
        />
      </View>

      {/* Category hint */}
      <View style={styles.categoryHint}>
        <View style={[styles.categoryHintBadge, { backgroundColor: categoryInfo.color + '15' }]}>
          <Ionicons name={categoryInfo.icon as any} size={14} color={categoryInfo.color} />
          <Text style={[styles.categoryHintText, { color: categoryInfo.color }]}>{categoryInfo.label}</Text>
        </View>
      </View>

      {/* Main Form Card */}
      <View style={styles.card}>

        {/* Category selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>الفئة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesList}>
            {(Object.keys(BILL_CATEGORIES) as BillCategory[]).map((cat) => {
              const info = BILL_CATEGORIES[cat];
              const isSelected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catItem, isSelected && { borderColor: info.color }]}
                  onPress={() => setCategory(cat)}
                >
                  <View style={[styles.catIcon, { backgroundColor: isSelected ? info.color : theme.colors.surfaceLight }]}>
                    <Ionicons
                      name={isSelected ? info.icon as any : `${info.icon}-outline` as any}
                      size={20}
                      color={isSelected ? '#FFFFFF' : theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.catName, isSelected && { color: info.color, fontWeight: getPlatformFontWeight('700') }]} numberOfLines={1}>
                    {info.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {/* Title */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="receipt-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput
            placeholder="عنوان الفاتورة (مثال: فاتورة الكهرباء)"
            value={title}
            onChangeText={setTitle}
            style={styles.fieldInput}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        <View style={styles.divider} />

        {/* Due Date */}
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.fieldText}>
            تاريخ الاستحقاق: {dueDate.toLocaleDateString('ar-IQ-u-nu-latn', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Recurrence */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="repeat-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <View style={styles.fieldToggleRow}>
            <Text style={styles.fieldText}>فاتورة متكررة</Text>
            <Switch
              value={hasRecurrence}
              onValueChange={setHasRecurrence}
              trackColor={{ false: theme.colors.border, true: categoryInfo.color + '80' }}
              thumbColor={hasRecurrence ? categoryInfo.color : theme.colors.surfaceCard}
            />
          </View>
        </View>

        {hasRecurrence && (
          <View style={styles.recurrenceChips}>
            {(['monthly', 'weekly', 'quarterly', 'yearly'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setRecurrenceType(type)}
                style={[styles.freqChip, recurrenceType === type && { backgroundColor: categoryInfo.color }]}
              >
                <Text style={[styles.freqChipText, recurrenceType === type && { color: '#FFFFFF' }]}>
                  {recurrenceLabels[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.divider} />

        {/* Reminder Days */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="notifications-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <Text style={[styles.fieldText, { flex: 0, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }]}>تذكير قبل</Text>
          <TextInput
            value={reminderDaysBefore}
            onChangeText={(v) => setReminderDaysBefore(convertArabicToEnglish(v))}
            keyboardType="numeric"
            style={styles.miniInput}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
          />
          <Text style={[styles.fieldText, { flex: 0 }]}>أيام</Text>
        </View>

        <View style={styles.divider} />

        {/* Notes */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
          </View>
          <TextInput
            placeholder="ملاحظات إضافية..."
            value={description}
            onChangeText={setDescription}
            style={styles.fieldInput}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
        </View>

        {/* Bill Image */}
        {imageUri ? (
          <>
            <View style={styles.divider} />
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.billImage} />
              <TouchableOpacity onPress={handleRemoveImage} style={styles.removeImageBtn}>
                <Ionicons name="close-circle" size={26} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.divider} />
            <TouchableOpacity onPress={() => setShowImagePicker(true)} style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <Ionicons name="camera-outline" size={20} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.fieldText, { color: theme.colors.textSecondary }]}>إضافة صورة الفاتورة</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <CustomDatePicker
          value={dueDate}
          onChange={(_, selectedDate) => {
            if (selectedDate) setDueDate(selectedDate);
            if (Platform.OS === 'android') setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Image Picker Bottom Sheet */}
      <AppBottomSheet
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        title="اختر مصدر الصورة"
      >
        <View style={styles.imagePickerOptions}>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => handlePickImage('camera')}>
            <View style={[styles.imagePickerIconBadge, { backgroundColor: theme.colors.primary + '15' }]}>
              <Ionicons name="camera-outline" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.imagePickerOptionTitle}>التقاط صورة</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imagePickerOption} onPress={() => handlePickImage('library')}>
            <View style={[styles.imagePickerIconBadge, { backgroundColor: '#10B981' + '15' }]}>
              <Ionicons name="images-outline" size={28} color="#10B981" />
            </View>
            <Text style={styles.imagePickerOptionTitle}>من المكتبة</Text>
          </TouchableOpacity>
        </View>
      </AppBottomSheet>
    </ScreenContainer>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  amountSection: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    marginHorizontal: 8,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  amountInput: {
    fontSize: 48,
    fontWeight: getPlatformFontWeight('800'),
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
    height: 70,
  },
  categoryHint: {
    alignItems: 'center',
    marginBottom: 24,
  },
  categoryHintBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryHintText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 20,
    marginBottom: 40,
    ...getPlatformShadow('md'),
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 12,
    textAlign: isRTL ? 'right' : 'left',
    fontWeight: getPlatformFontWeight('600'),
  },
  categoriesList: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 10,
  },
  catItem: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    padding: 4,
    borderColor: 'transparent',
    borderRadius: 16,
  },
  catIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...getPlatformShadow('xs'),
  },
  catName: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    width: 60,
    textAlign: 'center',
    fontWeight: getPlatformFontWeight('600'),
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 14,
    opacity: 0.5,
  },
  fieldRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  fieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontSize: 16,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
    height: 50,
    padding: 0,
  },
  fieldText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
    fontFamily: theme.typography.fontFamily,
  },
  fieldToggleRow: {
    flex: 1,
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recurrenceChips: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
    flexWrap: 'wrap',
    paddingLeft: isRTL ? 0 : 56,
    paddingRight: isRTL ? 56 : 0,
  },
  freqChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  freqChipText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textSecondary,
    fontWeight: getPlatformFontWeight('600'),
  },
  miniInput: {
    width: 56,
    height: 40,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    padding: 0,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  billImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.background + 'CC',
    borderRadius: 13,
  },
  imagePickerOptions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 16,
  },
  imagePickerOption: {
    flex: 1,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  imagePickerIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  imagePickerOptionTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
  },
});
