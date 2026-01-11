import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextInput, IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { ExpenseCategory, EXPENSE_CATEGORIES, RECURRENCE_TYPES } from '../types';
import { 
  addRecurringExpense, 
  updateRecurringExpense, 
  RecurringExpense 
} from '../database/database';
import { getCustomCategories } from '../database/database';

interface AddRecurringExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  editingExpense?: RecurringExpense | null;
}

export const AddRecurringExpenseModal: React.FC<AddRecurringExpenseModalProps> = ({
  visible,
  onClose,
  editingExpense,
}) => {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurrenceValue, setRecurrenceValue] = useState('1');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slideAnim] = useState(new Animated.Value(0));
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);

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
    loadCustomCategories();
    if (editingExpense) {
      setTitle(editingExpense.title);
      setAmount(editingExpense.amount.toString());
      setCategory(editingExpense.category as ExpenseCategory);
      setRecurrenceType(editingExpense.recurrenceType);
      setRecurrenceValue(editingExpense.recurrenceValue.toString());
      setStartDate(new Date(editingExpense.startDate));
      setEndDate(editingExpense.endDate ? new Date(editingExpense.endDate) : null);
      setHasEndDate(!!editingExpense.endDate);
      setDescription(editingExpense.description || '');
    } else {
      resetForm();
    }
  }, [editingExpense, visible]);

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {
      console.error('Error loading custom categories:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('food');
    setRecurrenceType('monthly');
    setRecurrenceValue('1');
    setStartDate(new Date());
    setEndDate(null);
    setHasEndDate(false);
    setDescription('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال عنوان المصروف');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    const recValue = parseInt(recurrenceValue);
    if (isNaN(recValue) || recValue <= 0) {
      Alert.alert('تنبيه', 'يرجى إدخال قيمة تكرار صحيحة');
      return;
    }

    if (hasEndDate && endDate && endDate <= startDate) {
      Alert.alert('تنبيه', 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
      return;
    }

    setLoading(true);

    try {
      const expenseData = {
        title: title.trim(),
        amount: Number(amount),
        category: category,
        recurrenceType: recurrenceType,
        recurrenceValue: recValue,
        startDate: startDate.toISOString().split('T')[0],
        endDate: hasEndDate && endDate ? endDate.toISOString().split('T')[0] : undefined,
        description: description.trim(),
        isActive: true,
      };

      if (editingExpense) {
        await updateRecurringExpense(editingExpense.id, expenseData);
      } else {
        await addRecurringExpense(expenseData);
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving recurring expense:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ المصروف المتكرر');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getCategoryName = (cat: ExpenseCategory) => {
    return EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES] || 
           customCategories.find(c => c.name === cat)?.name || 
           cat;
  };

  const allCategories = [
    ...Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[],
    ...customCategories.map(c => c.name as ExpenseCategory),
  ];

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY }],
              paddingBottom: insets.bottom + theme.spacing.md,
            },
          ]}
        >
          <LinearGradient
            colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingExpense ? 'تعديل مصروف متكرر' : 'إضافة مصروف متكرر'}
              </Text>
              <IconButton
                icon="close"
                size={24}
                onPress={handleClose}
                iconColor={theme.colors.textPrimary}
              />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formGroup}>
                <Text style={styles.label}>العنوان</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="أدخل عنوان المصروف"
                  mode="outlined"
                  style={styles.input}
                  contentStyle={styles.inputContent}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>المبلغ</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  mode="outlined"
                  style={styles.input}
                  contentStyle={styles.inputContent}
                  left={<TextInput.Icon icon="currency-usd" />}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الفئة</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Text style={styles.pickerText}>{getCategoryName(category)}</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                {showCategoryPicker && (
                  <View style={styles.pickerOptions}>
                    {allCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.pickerOption,
                          category === cat && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setCategory(cat);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            category === cat && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {getCategoryName(cat)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>نوع التكرار</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowRecurrencePicker(!showRecurrencePicker)}
                >
                  <Text style={styles.pickerText}>{RECURRENCE_TYPES[recurrenceType]}</Text>
                  <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                {showRecurrencePicker && (
                  <View style={styles.pickerOptions}>
                    {Object.entries(RECURRENCE_TYPES).map(([key, label]) => (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.pickerOption,
                          recurrenceType === key && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setRecurrenceType(key as any);
                          setShowRecurrencePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            recurrenceType === key && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>قيمة التكرار</Text>
                <TextInput
                  value={recurrenceValue}
                  onChangeText={setRecurrenceValue}
                  placeholder="1"
                  keyboardType="number-pad"
                  mode="outlined"
                  style={styles.input}
                  contentStyle={styles.inputContent}
                />
                <Text style={styles.hint}>
                  مثال: إذا كان التكرار شهري والقيمة 2، فسيكون كل شهرين
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>تاريخ البداية</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {startDate.toLocaleDateString('ar-IQ')}
                  </Text>
                  <Ionicons name="calendar" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowStartDatePicker(false);
                      if (selectedDate) {
                        setStartDate(selectedDate);
                      }
                    }}
                  />
                )}
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>تاريخ انتهاء (اختياري)</Text>
                  <TouchableOpacity
                    style={[styles.switch, hasEndDate && styles.switchActive]}
                    onPress={() => {
                      setHasEndDate(!hasEndDate);
                      if (hasEndDate) {
                        setEndDate(null);
                      }
                    }}
                  >
                    <View style={[styles.switchThumb, hasEndDate && styles.switchThumbActive]} />
                  </TouchableOpacity>
                </View>
                {hasEndDate && (
                  <>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Text style={styles.pickerText}>
                        {endDate ? endDate.toLocaleDateString('ar-IQ') : 'اختر التاريخ'}
                      </Text>
                      <Ionicons name="calendar" size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    {showEndDatePicker && (
                      <DateTimePicker
                        value={endDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowEndDatePicker(false);
                          if (selectedDate) {
                            setEndDate(selectedDate);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الوصف (اختياري)</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="أدخل وصفاً للمصروف"
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  style={styles.input}
                  contentStyle={styles.inputContent}
                />
              </View>
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
                disabled={loading}
              >
                <LinearGradient
                  colors={[theme.colors.primary, '#2563EB']}
                  style={styles.saveButtonGradient}
                >
                  <Text style={styles.saveButtonText}>
                    {loading ? 'جاري الحفظ...' : editingExpense ? 'تحديث' : 'حفظ'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    maxHeight: '90%',
    width: '100%',
  },
  modalGradient: {
    width: '100%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  formGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
  },
  inputContent: {
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  pickerButton: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pickerText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  pickerOptions: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 200,
  },
  pickerOption: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.primary + '20',
  },
  pickerOptionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  pickerOptionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    fontFamily: theme.typography.fontFamily,
  },
  switchRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    padding: 2,
  },
  switchActive: {
    backgroundColor: theme.colors.primary,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
});
