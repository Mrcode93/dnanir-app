import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Pressable,
  Keyboard,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { CustomDatePicker } from './CustomDatePicker';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { AppBottomSheet, AppButton } from '../design-system';
import { Bill, BillCategory, BILL_CATEGORIES } from '../types';
import { addBill, updateBill } from '../database/database';
import { scheduleBillReminder } from '../services/billService';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';

interface AddBillModalProps {
  visible: boolean;
  onClose: () => void;
  editingBill?: Bill | null;
}

export const AddBillModal: React.FC<AddBillModalProps> = ({
  visible,
  onClose,
  editingBill,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, currency } = useCurrency();
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


  useEffect(() => {
    if (editingBill) {
      setTitle(editingBill.title);
      setAmount(formatNumberWithCommas(editingBill.amount));
      setCategory(editingBill.category as BillCategory);
      setDueDate(new Date(editingBill.dueDate));
      setDescription(editingBill.description || '');
      setHasRecurrence(!!editingBill.recurrenceType);
      setRecurrenceType(editingBill.recurrenceType || 'monthly');
      setReminderDaysBefore(editingBill.reminderDaysBefore.toString());
    } else {
      resetForm();
    }
  }, [editingBill, visible]);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('utilities');
    setDueDate(new Date());
    setDescription('');
    setHasRecurrence(false);
    setRecurrenceType('monthly');
    setReminderDaysBefore('3');
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

    if (!reminderDaysBefore.trim() || isNaN(Number(reminderDaysBefore)) || Number(reminderDaysBefore) < 0) {
      alertService.warning('تنبيه', 'يرجى إدخال عدد أيام التذكير صحيح');
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
        isPaid: editingBill?.isPaid || false,
        paidDate: editingBill?.paidDate,
        reminderDaysBefore: Number(reminderDaysBefore),
      };

      if (editingBill) {
        await updateBill(editingBill.id, billData);
      } else {
        const billId = await addBill(billData);
        // Schedule reminder for new bills
        await scheduleBillReminder(billId);
      }

      onClose();
      resetForm();
      alertService.toastSuccess(editingBill ? 'تم تحديث الفاتورة بنجاح' : 'تم إضافة الفاتورة بنجاح');
    } catch (error) {
      
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getCategoryInfo = (cat: BillCategory) => {
    return BILL_CATEGORIES[cat];
  };


  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      title={editingBill ? 'تعديل الفاتورة' : 'فاتورة جديدة'}
      maxHeight="90%"
    >
      <ScrollView
        style={styles.scrollView}
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
            onChangeText={(val) => {
              const cleaned = convertArabicToEnglish(val);
              setAmount(formatNumberWithCommas(cleaned));
            }}
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
          <AppButton
            label={getCategoryInfo(category).label}
            onPress={() => {
              const categories = Object.keys(BILL_CATEGORIES) as BillCategory[];
              const currentIndex = categories.indexOf(category);
              const nextIndex = (currentIndex + 1) % categories.length;
              setCategory(categories[nextIndex]);
            }}
            variant="secondary"
            leftIcon={getCategoryInfo(category).icon as any}
            rightIcon="chevron-down"
            style={styles.categoryButton}
            labelStyle={styles.categoryButtonText}
          />
        </View>

        {/* Due Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>تاريخ الاستحقاق *</Text>
          <AppButton
            label={dueDate.toLocaleDateString('ar-IQ-u-nu-latn', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            onPress={() => setShowDatePicker(true)}
            variant="secondary"
            leftIcon="calendar"
            style={styles.dateButton}
            labelStyle={styles.dateButtonText}
          />
          {showDatePicker && (
            <CustomDatePicker
              value={dueDate}
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setDueDate(selectedDate);
                }
                if (Platform.OS === 'android') setShowDatePicker(false);
              }}
              onClose={() => setShowDatePicker(false)}
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
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={hasRecurrence ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
          {hasRecurrence && (
            <AppButton
              label={recurrenceType === 'monthly' ? 'شهري' :
                recurrenceType === 'weekly' ? 'أسبوعي' :
                  recurrenceType === 'quarterly' ? 'ربع سنوي' : 'سنوي'}
              onPress={() => {
                const types: ('monthly' | 'yearly' | 'quarterly' | 'weekly')[] = ['monthly', 'weekly', 'quarterly', 'yearly'];
                const currentIndex = types.indexOf(recurrenceType);
                const nextIndex = (currentIndex + 1) % types.length;
                setRecurrenceType(types[nextIndex]);
              }}
              variant="secondary"
              rightIcon="chevron-down"
              style={styles.recurrenceButton}
              labelStyle={styles.recurrenceButtonText}
            />
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

        {/* Save Button */}
        <AppButton
          label={editingBill ? 'تحديث' : 'حفظ'}
          onPress={handleSave}
          variant="primary"
          loading={loading}
          leftIcon="checkmark"
          style={styles.saveButton}
        />
      </ScrollView>
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  scrollView: {
    flex: 1,
    paddingHorizontal: 12,
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
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
  },
  inputContent: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    textAlign: isRTL ? 'right' : 'left',
  },
  categoryButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceLight,
    padding: 12,
  },
  categoryButtonContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryButtonText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    flex: 1,
    marginHorizontal: 12,
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
    marginBottom: 12,
  },
});
