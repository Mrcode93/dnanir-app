import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  I18nManager,
  Platform,
} from 'react-native';
import { Modal, Portal, Button } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { FinancialGoal, GoalCategory, GOAL_CATEGORIES } from '../types';

interface AddGoalModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSave: (goal: Omit<FinancialGoal, 'id' | 'createdAt'>) => Promise<void>;
  editingGoal?: FinancialGoal | null;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  visible,
  onDismiss,
  onSave,
  editingGoal,
}) => {
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [category, setCategory] = useState<GoalCategory>('other');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setTargetAmount(editingGoal.targetAmount.toString());
      setCurrentAmount(editingGoal.currentAmount.toString());
      setCategory(editingGoal.category);
      setDescription(editingGoal.description || '');
      setTargetDate(editingGoal.targetDate ? new Date(editingGoal.targetDate) : null);
      setCompleted(editingGoal.completed);
    } else {
      resetForm();
    }
  }, [editingGoal, visible]);

  const resetForm = () => {
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('0');
    setCategory('other');
    setDescription('');
    setTargetDate(null);
    setCompleted(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !targetAmount.trim()) {
      return;
    }

    const targetAmountNum = parseFloat(targetAmount);
    const currentAmountNum = parseFloat(currentAmount) || 0;

    if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
      return;
    }

    await onSave({
      title: title.trim(),
      targetAmount: targetAmountNum,
      currentAmount: currentAmountNum,
      targetDate: targetDate ? targetDate.toISOString().split('T')[0] : undefined,
      category,
      description: description.trim() || undefined,
      completed,
    });

    resetForm();
    onDismiss();
  };

  const categories = Object.entries(GOAL_CATEGORIES) as [GoalCategory, { label: string; icon: string }][];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editingGoal ? 'تعديل الهدف' : 'إضافة هدف جديد'}
            </Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>عنوان الهدف *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: توفير لسيارة"
                placeholderTextColor={theme.colors.textMuted}
                textAlign="right"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: theme.spacing.md }]}>
                <Text style={styles.label}>المبلغ المستهدف *</Text>
                <TextInput
                  style={styles.input}
                  value={targetAmount}
                  onChangeText={setTargetAmount}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={theme.colors.textMuted}
                  textAlign="right"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>المبلغ الحالي</Text>
                <TextInput
                  style={styles.input}
                  value={currentAmount}
                  onChangeText={setCurrentAmount}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={theme.colors.textMuted}
                  textAlign="right"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>الفئة</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContainer}
              >
                {categories.map(([catKey, catInfo]) => (
                  <TouchableOpacity
                    key={catKey}
                    style={[
                      styles.categoryChip,
                      category === catKey && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(catKey)}
                  >
                    <Ionicons
                      name={catInfo.icon as any}
                      size={20}
                      color={category === catKey ? theme.colors.textInverse : theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === catKey && styles.categoryChipTextActive,
                      ]}
                    >
                      {catInfo.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>تاريخ الهدف (اختياري)</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.dateButtonText}>
                  {targetDate
                    ? targetDate.toLocaleDateString('ar-IQ')
                    : 'اختر التاريخ'}
                </Text>
                {targetDate && (
                  <TouchableOpacity
                    onPress={() => setTargetDate(null)}
                    style={styles.removeDateButton}
                  >
                    <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={targetDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setTargetDate(selectedDate);
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>الوصف (اختياري)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="أضف ملاحظات حول هدفك..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                textAlign="right"
              />
            </View>

            {editingGoal && (
              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setCompleted(!completed)}
                >
                  {completed ? (
                    <Ionicons name="checkbox" size={24} color={theme.colors.success} />
                  ) : (
                    <Ionicons name="checkbox-outline" size={24} color={theme.colors.textSecondary} />
                  )}
                  <Text style={styles.checkboxLabel}>تم إنجاز الهدف</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={[styles.button, styles.cancelButton]}
              labelStyle={styles.cancelButtonLabel}
            >
              إلغاء
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.button, styles.saveButton]}
              labelStyle={styles.saveButtonLabel}
              disabled={!title.trim() || !targetAmount.trim()}
            >
              حفظ
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: theme.colors.surfaceCard,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    ...theme.shadows.lg,
  
  },
  scrollView: {
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  form: {
    padding: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    height: 80,
    paddingTop: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
  },
  categoryScroll: {
    marginTop: theme.spacing.sm,
  },
  categoryContainer: {
    paddingVertical: theme.spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(isRTL ? { marginLeft: theme.spacing.sm } : { marginRight: theme.spacing.sm }),
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    ...(isRTL ? { marginRight: theme.spacing.xs } : { marginLeft: theme.spacing.xs }),
    fontFamily: theme.typography.fontFamily,
  },
  categoryChipTextActive: {
    color: theme.colors.textInverse,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateButtonText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  removeDateButton: {
    padding: theme.spacing.xs,
  },
  checkboxContainer: {
    marginTop: theme.spacing.md,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    flex: 1,
  },
  cancelButton: {
    ...(isRTL ? { marginLeft: theme.spacing.md } : { marginRight: theme.spacing.md }),
    borderColor: theme.colors.border,
  },
  cancelButtonLabel: {
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonLabel: {
    color: theme.colors.textInverse,
    fontFamily: theme.typography.fontFamily,
  },
});
