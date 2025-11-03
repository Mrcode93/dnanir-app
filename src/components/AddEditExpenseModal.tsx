import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  I18nManager,
} from 'react-native';
import {
  Modal,
  Card,
  Title,
  TextInput,
  Button,
  SegmentedButtons,
  IconButton,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import RTLText from './RTLText';

import { Expense, ExpenseCategory, EXPENSE_CATEGORIES } from '../types';
import { addExpense, updateExpense } from '../database/database';
import { gradientColors, colors } from '../utils/gradientColors';
import { useNotifications } from '../hooks/useNotifications';

interface AddEditExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  expense?: Expense | null;
}

const AddEditExpenseModal: React.FC<AddEditExpenseModalProps> = ({
  visible,
  onClose,
  expense,
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { notifyExpenseAdded } = useNotifications();

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toString());
      setCategory(expense.category as ExpenseCategory);
      setDate(new Date(expense.date));
      setDescription(expense.description || '');
    } else {
      resetForm();
    }
  }, [expense, visible]);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('food');
    setDate(new Date());
    setDescription('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال عنوان المصروف');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('خطأ', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);

    try {
      const expenseData = {
        title: title.trim(),
        amount: Number(amount),
        category: category,
        date: date.toISOString().split('T')[0],
        description: description.trim(),
      };

      if (expense) {
        await updateExpense(expense.id, expenseData);
      } else {
        await addExpense(expenseData);
        // Send notification for new expense
        await notifyExpenseAdded(Number(amount), EXPENSE_CATEGORIES[category]);
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ المصروف');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const categoryButtons = Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => ({
    value: key,
    label,
  }));

  return (
    <Modal
      visible={visible}
      onDismiss={handleClose}
      contentContainerStyle={styles.modalContainer}
      dismissable={true}
      dismissableBackButton={true}
    >
      <LinearGradient
        colors={gradientColors.background.card}
        style={styles.container}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandle} />
        
        {/* Header */}
        <View style={styles.header}>
          <RTLText style={styles.title} fontFamily="Cairo-Regular">
            {expense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
          </RTLText>
          <IconButton
            icon="close"
            size={24}
            onPress={handleClose}
            style={styles.closeButton}
            iconColor={colors.text}
          />
        </View>

        {/* Form Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
          <View style={styles.form}>
            <TextInput
              label="عنوان المصروف"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              contentStyle={styles.inputContent}
              theme={{
                fonts: {
                  bodyMedium: {
                    fontFamily: 'Cairo-Regular',
                  },
                },
              }}
            />

            <TextInput
              label="وصف المصروف (اختياري)"
              value={description}
              onChangeText={setDescription}
              style={styles.input}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              multiline
              numberOfLines={3}
              contentStyle={styles.inputContent}
              theme={{
                fonts: {
                  bodyMedium: {
                    fontFamily: 'Cairo-Regular',
                  },
                },
              }}
            />

            <TextInput
              label="المبلغ (دينار)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={styles.input}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              contentStyle={styles.inputContent}
              theme={{
                fonts: {
                  bodyMedium: {
                    fontFamily: 'Cairo-Regular',
                  },
                },
              }}
            />

            <View style={styles.dateContainer}>
              <Button
                mode="outlined"
                onPress={() => setShowDatePicker(true)}
                style={styles.dateButton}
                labelStyle={styles.dateButtonLabel}
                buttonColor="transparent"
              >
                التاريخ: {date.toLocaleDateString('ar-IQ')}
              </Button>
            </View>

            {showDatePicker && (
              <LinearGradient
                colors={gradientColors.primary.medium}
                style={styles.datePickerContainer}
              >
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setDate(selectedDate);
                    }
                  }}
                  style={styles.datePicker}
                  themeVariant="dark"
                />
              </LinearGradient>
            )}

            <View style={styles.categoryContainer}>
              <RTLText style={styles.categoryTitle} fontFamily="Cairo-Regular">
                فئة المصروف
              </RTLText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScrollView}
                contentContainerStyle={styles.categoryScrollContent}
              >
                <SegmentedButtons
                  value={category}
                  onValueChange={(value) => setCategory(value as ExpenseCategory)}
                  buttons={categoryButtons}
                  style={styles.segmentedButtons}
                  theme={{
                    colors: {
                      secondaryContainer: colors.primary,
                      onSecondaryContainer: colors.text,
                      outline: colors.border,
                      onSurface: colors.text,
                    },
                    fonts: {
                      bodyMedium: {
                        fontFamily: 'Cairo-Regular',
                      },
                    },
                  }}
                />
              </ScrollView>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleClose}
            style={styles.cancelButton}
            labelStyle={styles.cancelButtonLabel}
            buttonColor="transparent"
          >
            إلغاء
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            labelStyle={styles.saveButtonLabel}
            buttonColor={colors.primary}
          >
            {expense ? 'تحديث' : 'حفظ'}
          </Button>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 0,
    backgroundColor: colors.overlay,
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    elevation: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    height: '100%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.textSecondary,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: 20,
  },
  title: {
    fontSize: 20,
    paddingTop: 16,
    fontWeight: 'bold',
    paddingBottom: 16,
    color: colors.primary,
    flex: 1,
    textAlign: 'right',
  },
  closeButton: {
    backgroundColor: colors.error,
    borderRadius: 20,
    elevation: 4,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 20,
    direction: 'rtl',
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    textAlign: 'right',
    direction: 'rtl',
  },
  inputContent: {
    textAlign: 'right',
    fontFamily: 'Cairo-Regular',
    writingDirection: 'rtl',
  },
  dateContainer: {
    marginBottom: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
  },
  dateButton: {
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  dateButtonLabel: {
    color: colors.primary,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
  },
  datePickerContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  datePicker: {
    backgroundColor: 'transparent',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'right',
  },
  categoryScrollView: {
    marginBottom: 8,
  },
  categoryScrollContent: {
    paddingHorizontal: 0,
  },
  segmentedButtons: {
    backgroundColor: colors.surfaceLight,
    fontFamily: 'Cairo-Regular',
  },
  actions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderColor: colors.border,
    borderWidth: 1,
  },
  cancelButtonLabel: {
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  saveButtonLabel: {
    color: colors.text,
    fontFamily: 'Cairo-Regular',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AddEditExpenseModal;