import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { Bill, BillCategory, BILL_CATEGORIES } from '../types';
import { addBill, updateBill } from '../database/database';
import { scheduleBillReminder } from '../services/billService';
import { alertService } from '../services/alertService';
import { isRTL } from '../utils/rtl';
import { useCurrency } from '../hooks/useCurrency';

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
  const insets = useSafeAreaInsets();
  const { currencyCode, formatCurrency } = useCurrency();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<BillCategory>('utilities');
  const [dueDate, setDueDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'monthly' | 'yearly' | 'quarterly' | 'weekly'>('monthly');
  const [reminderDaysBefore, setReminderDaysBefore] = useState('3');

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (editingBill) {
      setTitle(editingBill.title);
      setAmount(editingBill.amount.toString());
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
      alertService.success('نجح', editingBill ? 'تم تحديث الفاتورة بنجاح' : 'تم إضافة الفاتورة بنجاح');
    } catch (error) {
      console.error('Error saving bill:', error);
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

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ translateY }],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
                style={[styles.modalGradient, { paddingBottom: insets.bottom }]}
              >
                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <View style={[styles.iconBadge, { backgroundColor: getCategoryInfo(category).icon + '20' }]}>
                      <Ionicons
                        name={getCategoryInfo(category).icon as any}
                        size={24}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.headerText}>
                      <Text style={styles.title}>
                        {editingBill ? 'تعديل الفاتورة' : 'فاتورة جديدة'}
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
                      onChangeText={setAmount}
                      placeholder="0"
                      mode="outlined"
                      keyboardType="numeric"
                      style={styles.input}
                      contentStyle={styles.inputContent}
                      outlineColor={theme.colors.border}
                      activeOutlineColor={theme.colors.primary}
                      right={
                        <TextInput.Affix text={formatCurrency(0).replace('0', '').trim()} />
                      }
                    />
                  </View>

                  {/* Category */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>الفئة *</Text>
                    <Pressable
                      onPress={() => {
                        // Show category picker
                        const categories = Object.keys(BILL_CATEGORIES) as BillCategory[];
                        const currentIndex = categories.indexOf(category);
                        const nextIndex = (currentIndex + 1) % categories.length;
                        setCategory(categories[nextIndex]);
                      }}
                      style={styles.categoryButton}
                    >
                      <View style={styles.categoryButtonContent}>
                        <Ionicons
                          name={getCategoryInfo(category).icon as any}
                          size={20}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.categoryButtonText}>
                          {getCategoryInfo(category).label}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={20}
                          color={theme.colors.textSecondary}
                        />
                      </View>
                    </Pressable>
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
                      onChangeText={setReminderDaysBefore}
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
                            {editingBill ? 'تحديث' : 'حفظ'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </ScrollView>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
  },
  modalGradient: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: isRTL ? 0 : 12,
    marginLeft: isRTL ? 12 : 0,
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
    maxHeight: 600,
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
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
    marginTop: 20,
    marginBottom: 20,
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
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
