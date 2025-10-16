import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import RTLText from './RTLText';

import { Income, IncomeSource, INCOME_SOURCES } from '../types';
import { addIncome, updateIncome } from '../database/database';
import { gradientColors, colors } from '../utils/gradientColors';
import { useNotifications } from '../hooks/useNotifications';

interface AddEditIncomeModalProps {
  visible: boolean;
  onClose: () => void;
  income?: Income | null;
}

const AddEditIncomeModal: React.FC<AddEditIncomeModalProps> = ({
  visible,
  onClose,
  income,
}) => {
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState<IncomeSource>('salary');
  const [date, setDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { notifyIncomeAdded } = useNotifications();

  useEffect(() => {
    if (income) {
      setSource(income.source);
      setAmount(income.amount.toString());
      setIncomeSource(income.source as IncomeSource);
      setDate(new Date(income.date));
      setDescription(income.description || '');
    } else {
      resetForm();
    }
  }, [income, visible]);

  const resetForm = () => {
    setSource('');
    setAmount('');
    setIncomeSource('salary');
    setDate(new Date());
    setDescription('');
  };

  const handleSave = async () => {
    if (!source.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال مصدر الدخل');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('خطأ', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);

    try {
      const incomeData = {
        source: source.trim(),
        amount: Number(amount),
        date: date.toISOString().split('T')[0],
        description: description.trim(),
      };

      if (income) {
        await updateIncome(income.id, incomeData);
      } else {
        await addIncome(incomeData);
        // Send notification for new income
        await notifyIncomeAdded(Number(amount), INCOME_SOURCES[incomeSource]);
      }

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving income:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ الدخل');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const sourceButtons = Object.entries(INCOME_SOURCES).map(([key, label]) => ({
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
            {income ? 'تعديل الدخل' : 'إضافة دخل جديد'}
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
              label="مصدر الدخل"
              value={source}
              onChangeText={setSource}
              style={styles.input}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
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

            <View style={styles.sourceContainer}>
              <RTLText style={styles.sourceTitle} fontFamily="Cairo-Regular">
                نوع المصدر
              </RTLText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.sourceScrollView}
                contentContainerStyle={styles.sourceScrollContent}
              >
                <SegmentedButtons
                  value={incomeSource}
                  onValueChange={(value) => setIncomeSource(value as IncomeSource)}
                  buttons={sourceButtons}
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

            <TextInput
              label="وصف (اختياري)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={styles.input}
              mode="outlined"
              outlineColor={colors.border}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
            />
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
            {income ? 'تحديث' : 'حفظ'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingTop: 16,
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
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
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
    backgroundColor: colors.primary,
   
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  datePicker: {
    backgroundColor: 'transparent',
    
  },
  sourceContainer: {
    marginBottom: 16,
  },
  sourceTitle: {
    paddingTop: 16,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'right',
  },
  sourceScrollView: {
    marginBottom: 8,
  },
  sourceScrollContent: {
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
    borderTopColor: '#404040',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderColor: '#404040',
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

export default AddEditIncomeModal;