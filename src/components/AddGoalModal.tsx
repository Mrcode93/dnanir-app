import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { CustomDatePicker } from './CustomDatePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { isRTL } from '../utils/rtl';
import { AppBottomSheet, AppButton } from '../design-system';
import { FinancialGoal, GoalCategory, GOAL_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { alertService } from '../services/alertService';
import { convertCurrency, formatCurrencyAmount } from '../services/currencyService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { CurrencyPickerModal } from './CurrencyPickerModal';

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
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, formatCurrency } = useCurrency();
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [category, setCategory] = useState<GoalCategory>('other');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertedTargetAmount, setConvertedTargetAmount] = useState<number | null>(null);
  const [convertedCurrentAmount, setConvertedCurrentAmount] = useState<number | null>(null);


  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

  // Convert amounts when they change
  useEffect(() => {
    const convertAmounts = async () => {
      const cleanTargetAmount = targetAmount.replace(/,/g, '');
      const cleanCurrentAmount = currentAmount.replace(/,/g, '');

      if (cleanTargetAmount && !isNaN(Number(cleanTargetAmount)) && Number(cleanTargetAmount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(cleanTargetAmount), currency, currencyCode);
          setConvertedTargetAmount(converted);
        } else {
          setConvertedTargetAmount(null);
        }
      } else {
        setConvertedTargetAmount(null);
      }

      if (cleanCurrentAmount && !isNaN(Number(cleanCurrentAmount)) && Number(cleanCurrentAmount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(cleanCurrentAmount), currency, currencyCode);
          setConvertedCurrentAmount(converted);
        } else {
          setConvertedCurrentAmount(null);
        }
      } else {
        setConvertedCurrentAmount(null);
      }
    };

    convertAmounts();
  }, [targetAmount, currentAmount, currency, currencyCode]);

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setTargetAmount(formatNumberWithCommas(editingGoal.targetAmount));
      setCurrentAmount(formatNumberWithCommas(editingGoal.currentAmount));
      setCategory(editingGoal.category);
      setDescription(editingGoal.description || '');
      setTargetDate(editingGoal.targetDate ? new Date(editingGoal.targetDate) : null);
      setCompleted(editingGoal.completed);
      setCurrency(editingGoal.currency || currencyCode);
    } else {
      resetForm();
    }
  }, [editingGoal, visible, currencyCode]);

  const resetForm = () => {
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('0');
    setCategory('other');
    setDescription('');
    setTargetDate(null);
    setCompleted(false);
    setCurrency(currencyCode);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال عنوان الهدف');
      return;
    }

    Keyboard.dismiss();

    const cleanTargetAmount = targetAmount.replace(/,/g, '');
    const cleanCurrentAmount = currentAmount.replace(/,/g, '');

    if (!cleanTargetAmount.trim() || isNaN(Number(cleanTargetAmount)) || Number(cleanTargetAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ مستهدف صحيح');
      return;
    }

    const targetAmountNum = parseFloat(cleanTargetAmount);
    const currentAmountNum = parseFloat(cleanCurrentAmount) || 0;

    if (isNaN(targetAmountNum) || targetAmountNum <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ مستهدف صحيح');
      return;
    }

    setLoading(true);

    try {
      await onSave({
        title: title.trim(),
        targetAmount: targetAmountNum,
        currentAmount: currentAmountNum,
        targetDate: targetDate ? targetDate.toISOString().split('T')[0] : undefined,
        category,
        description: description.trim() || undefined,
        completed,
        currency: currency,
      });

      resetForm();
      onDismiss();
    } catch (error) {
      
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الهدف');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onDismiss();
  };

  const categories = Object.entries(GOAL_CATEGORIES) as [GoalCategory, { label: string; icon: string }][];

  const categoryIcons: Record<GoalCategory, string> = {
    emergency: 'shield',
    vacation: 'airplane',
    car: 'car',
    house: 'home',
    wedding: 'heart',
    education: 'school',
    business: 'briefcase',
    other: 'star',
  };

  const categoryColors: Record<GoalCategory, string[]> = {
    emergency: ['#EF4444', '#DC2626'],
    vacation: ['#8B5CF6', '#7C3AED'],
    car: ['#10B981', '#059669'],
    house: ['#3B82F6', '#2563EB'],
    wedding: ['#EC4899', '#DB2777'],
    education: ['#06B6D4', '#0891B2'],
    business: ['#F59E0B', '#D97706'],
    other: ['#6B7280', '#4B5563'],
  };

  const selectedCurrencyData = CURRENCIES.find(c => c.code === currency);


  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      title={editingGoal ? 'تعديل الهدف' : 'هدف جديد'}
      maxHeight="98%"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
                  {/* Title Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>عنوان الهدف</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="مثال: توفير لسيارة"
                        mode="flat"
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        underlineColor="transparent"
                        activeUnderlineColor={theme.colors.primary}
                      />
                    </View>
                  </View>

                  {/* Amount Inputs */}
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: theme.spacing.md }]}>
                      <Text style={styles.label}>المبلغ المستهدف ({selectedCurrencyData?.symbol})</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          value={targetAmount}
                          onChangeText={(val) => {
                            const cleaned = convertArabicToEnglish(val);
                            setTargetAmount(formatNumberWithCommas(cleaned));
                          }}
                          placeholder="0.00"
                          keyboardType="numeric"
                          mode="flat"
                          style={styles.input}
                          contentStyle={styles.inputContent}
                          underlineColor="transparent"
                          activeUnderlineColor={theme.colors.primary}
                          left={
                            <TextInput.Icon
                              icon={() => (
                                <Ionicons name="flag-outline" size={20} color={theme.colors.textSecondary} />
                              )}
                            />
                          }
                        />
                      </View>
                      {convertedTargetAmount !== null && currency !== currencyCode && (
                        <Text style={styles.convertedAmountText}>
                          ≈ {formatCurrency(convertedTargetAmount)}
                        </Text>
                      )}
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>المبلغ الحالي ({selectedCurrencyData?.symbol})</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          value={currentAmount}
                          onChangeText={(val) => {
                            const cleaned = convertArabicToEnglish(val);
                            setCurrentAmount(formatNumberWithCommas(cleaned));
                          }}
                          placeholder="0.00"
                          keyboardType="numeric"
                          mode="flat"
                          style={styles.input}
                          contentStyle={styles.inputContent}
                          underlineColor="transparent"
                          activeUnderlineColor={theme.colors.primary}
                          left={
                            <TextInput.Icon
                              icon={() => (
                                <Ionicons name="cash-outline" size={20} color={theme.colors.textSecondary} />
                              )}
                            />
                          }
                        />
                      </View>
                      {convertedCurrentAmount !== null && currency !== currencyCode && (
                        <Text style={styles.convertedAmountText}>
                          ≈ {formatCurrency(convertedCurrentAmount)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Currency Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>العملة</Text>
                    <AppButton
                      label={`${selectedCurrencyData?.symbol} ${selectedCurrencyData?.name}`}
                      onPress={() => setShowCurrencyPicker(true)}
                      variant="primary"
                      leftIcon="cash"
                      rightIcon={isRTL ? "chevron-back" : "chevron-forward"}
                      style={styles.currencyButton}
                      labelStyle={styles.currencyButtonText}
                    />
                  </View>

                  {/* Category Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>الفئة</Text>
                    <View style={styles.categoryGrid}>
                      {categories.map(([catKey, catInfo]) => {
                        const isSelected = category === catKey;
                        return (
                          <AppButton
                            key={catKey}
                            label={catInfo.label}
                            onPress={() => setCategory(catKey)}
                            variant={isSelected ? 'primary' : 'secondary'}
                            leftIcon={isSelected ? (categoryIcons[catKey] as any) : (`${categoryIcons[catKey]}-outline` as any)}
                            style={[
                              styles.categoryOption,
                              isSelected && { backgroundColor: categoryColors[catKey][0] }
                            ]}
                            labelStyle={[
                              styles.categoryText,
                              isSelected && styles.categoryTextActive
                            ]}
                            size="lg"
                          />
                        );
                      })}
                    </View>
                  </View>

                  {/* Date Picker */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>تاريخ الهدف (اختياري)</Text>
                    <AppButton
                      label={targetDate
                        ? targetDate.toLocaleDateString('ar-IQ-u-nu-latn', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                        : 'اختر التاريخ'}
                      onPress={() => setShowDatePicker(true)}
                      variant="secondary"
                      leftIcon="calendar-outline"
                      rightIcon={targetDate ? "close-circle" : (isRTL ? "chevron-back" : "chevron-forward")}
                      style={styles.dateButton}
                      labelStyle={styles.dateButtonText}
                    />
                    {targetDate && (
                      <TouchableOpacity
                        onPress={() => setTargetDate(null)}
                        style={{ position: 'absolute', left: 10, top: 40, zIndex: 10 }}
                      />
                    )}
                    {showDatePicker && (
                      <CustomDatePicker
                        value={targetDate || new Date()}
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setTargetDate(selectedDate);
                          }
                          if (Platform.OS === 'android') setShowDatePicker(false);
                        }}
                        onClose={() => setShowDatePicker(false)}
                        minimumDate={new Date()}
                      />
                    )}
                  </View>

                  {/* Description Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>وصف (اختياري)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="أضف ملاحظات حول هدفك..."
                        multiline
                        numberOfLines={4}
                        mode="flat"
                        style={styles.input}
                        contentStyle={[styles.inputContent, styles.textAreaContent]}
                        underlineColor="transparent"
                        activeUnderlineColor={theme.colors.primary}
                      />
                    </View>
                  </View>

                  {/* Completed Checkbox */}
                  {editingGoal && (
                    <View style={styles.inputGroup}>
                      <TouchableOpacity
                        style={styles.checkboxContainer}
                        onPress={() => setCompleted(!completed)}
                        activeOpacity={0.7}
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
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <AppButton
          label="إلغاء"
          onPress={handleClose}
          variant="secondary"
          style={styles.cancelButton}
        />
        <AppButton
          label={editingGoal ? 'تحديث' : 'حفظ'}
          onPress={handleSave}
          variant="primary"
          loading={loading}
          leftIcon="checkmark-circle"
          style={styles.saveButton}
        />
      </View>

      <CurrencyPickerModal
        visible={showCurrencyPicker}
        selectedCurrency={currency}
        onSelect={(code) => { setCurrency(code); setShowCurrencyPicker(false); }}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </AppBottomSheet>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontFamily,
    writingDirection: 'rtl',
  },
  inputWrapper: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  input: {
    backgroundColor: 'transparent',
    fontSize: theme.typography.sizes.md,
  },
  inputContent: {
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
  },
  textAreaContent: {
    minHeight: 100,
    paddingTop: theme.spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    justifyContent: 'space-between',
  },
  dateButtonText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
    marginHorizontal: theme.spacing.sm,
  },
  removeDateButton: {
    padding: theme.spacing.xs,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  categoryOption: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
    marginBottom: theme.spacing.sm,
  },
  categoryGradient: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    minHeight: 90,
  },
  categoryDefault: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    minHeight: 90,
  },
  categoryText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('500'),
  },
  categoryTextActive: {
    fontSize: theme.typography.sizes.md,
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  checkboxLabel: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginLeft: theme.spacing.sm,
    writingDirection: 'rtl',
  },
  actions: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexShrink: 0,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },
  currencyButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  currencyButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  currencyButtonText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
    ...(isRTL ? { marginRight: theme.spacing.sm } : { marginLeft: theme.spacing.sm }),
  },
  currencyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  currencyModalContainer: {
    maxHeight: '70%',
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    overflow: 'hidden',
    zIndex: 1000,
  },
  currencyModalGradient: {
    maxHeight: '100%',
  },
  currencyModalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  currencyModalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  currencyModalCloseButton: {
    padding: theme.spacing.xs,
  },
  currencyModalScrollView: {
    maxHeight: 400,
  },
  currencyModalScrollContent: {
    padding: theme.spacing.md,
  },
  currencyOption: {
    flexDirection: isRTL ? 'row' : 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surfaceCard,
    marginBottom: theme.spacing.xs,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  currencyOptionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  currencyOptionTextSelected: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontStyle: 'italic',
  },
});
