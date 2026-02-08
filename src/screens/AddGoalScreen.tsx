import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, getPlatformShadow, getPlatformFontWeight } from '../utils/theme';
import { addFinancialGoal, updateFinancialGoal } from '../database/database';
import { FinancialGoal, GoalCategory, GOAL_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish } from '../utils/numbers';

interface AddGoalScreenProps {
  navigation: any;
  route: any;
}

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

export const AddGoalScreen: React.FC<AddGoalScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { currencyCode, formatCurrency } = useCurrency();
  const editingGoal = route?.params?.goal as FinancialGoal | undefined;

  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');
  const [category, setCategory] = useState<GoalCategory>('other');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasTargetDate, setHasTargetDate] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [convertedTargetAmount, setConvertedTargetAmount] = useState<number | null>(null);

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setTargetAmount(editingGoal.targetAmount.toString());
      setCurrentAmount(editingGoal.currentAmount.toString());
      setCategory(editingGoal.category);
      setDescription(editingGoal.description || '');
      setTargetDate(editingGoal.targetDate ? new Date(editingGoal.targetDate) : null);
      setHasTargetDate(!!editingGoal.targetDate);
      setCompleted(editingGoal.completed);
      setCurrency(editingGoal.currency || currencyCode);
    } else {
      resetForm();
    }
  }, [editingGoal]);

  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

  useEffect(() => {
    const convertAmount = async () => {
      if (targetAmount && !isNaN(Number(targetAmount)) && Number(targetAmount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(targetAmount), currency, currencyCode);
          setConvertedTargetAmount(converted);
        } else {
          setConvertedTargetAmount(null);
        }
      } else {
        setConvertedTargetAmount(null);
      }
    };
    convertAmount();
  }, [targetAmount, currency, currencyCode]);

  const resetForm = () => {
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('0');
    setCategory('other');
    setDescription('');
    setTargetDate(null);
    setHasTargetDate(false);
    setCompleted(false);
    setCurrency(currencyCode);
  };

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const handleSave = async () => {
    Keyboard.dismiss();

    if (!title.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال عنوان الهدف');
      return;
    }

    if (!targetAmount.trim() || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ مستهدف صحيح');
      return;
    }

    setLoading(true);

    try {
      const goalData = {
        title: title.trim(),
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount) || 0,
        targetDate: hasTargetDate && targetDate ? targetDate.toISOString().split('T')[0] : undefined,
        category,
        description: description.trim() || undefined,
        completed,
        currency,
      };

      if (editingGoal) {
        await updateFinancialGoal(editingGoal.id, goalData);
        alertService.success('نجح', 'تم تحديث الهدف بنجاح');
      } else {
        await addFinancialGoal(goalData);
        alertService.success('نجح', 'تم إضافة الهدف بنجاح');
      }

      handleClose();
    } catch (error) {
      console.error('Error saving goal:', error);
      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الهدف');
    } finally {
      setLoading(false);
    }
  };

  const categories = Object.entries(GOAL_CATEGORIES) as [GoalCategory, { label: string; icon: string }][];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <LinearGradient
          colors={[theme.colors.surfaceCard, theme.colors.surfaceLight]}
          style={styles.background}
        >
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon={isRTL ? "chevron-right" : "chevron-left"}
              size={28}
              onPress={handleClose}
              iconColor={theme.colors.textPrimary}
            />
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>
                {editingGoal ? 'تعديل الهدف' : 'إضافة هدف جديد'}
              </Text>
              <Text style={styles.headerSubtitle}>حدد هدفك المالي وتتبع تقدمك</Text>
            </View>
            <View style={[styles.headerIcon, { backgroundColor: categoryColors[category][0] + '20' }]}>
              <Ionicons
                name={categoryIcons[category] as any}
                size={24}
                color={categoryColors[category][0]}
              />
            </View>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title Input */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Ionicons name="bookmark-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.inputLabel}>عنوان الهدف</Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="مثال: توفير لسيارة جديدة"
                placeholderTextColor={theme.colors.textMuted}
                autoFocus
              />
            </View>

            {/* Amount Card */}
            <View style={styles.amountCard}>
              <View style={styles.amountHeader}>
                <View style={styles.amountIconBg}>
                  <Ionicons name="flag-outline" size={24} color={categoryColors[category][0]} />
                </View>
                <Text style={styles.amountLabel}>المبلغ المستهدف</Text>
              </View>

              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  value={targetAmount}
                  onChangeText={(val) => setTargetAmount(convertArabicToEnglish(val))}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType="numeric"
                />
                <Text style={[styles.currencyLabel, { color: categoryColors[category][0] }]}>
                  {CURRENCIES.find(c => c.code === currency)?.symbol || 'د.ع'}
                </Text>
              </View>

              {convertedTargetAmount !== null && currency !== currencyCode && (
                <Text style={styles.convertedAmountText}>
                  ≈ {formatCurrency(convertedTargetAmount)}
                </Text>
              )}

              {/* Current Amount */}
              <View style={styles.currentAmountRow}>
                <Text style={styles.currentAmountLabel}>المبلغ الحالي:</Text>
                <View style={styles.currentAmountInput}>
                  <TextInput
                    style={styles.currentAmountTextInput}
                    value={currentAmount}
                    onChangeText={(val) => setCurrentAmount(convertArabicToEnglish(val))}
                    placeholder="0"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="numeric"
                  />
                  <Text style={styles.currentAmountCurrency}>
                    {CURRENCIES.find(c => c.code === currency)?.symbol}
                  </Text>
                </View>
              </View>

              {/* Currency Selection */}
              <TouchableOpacity
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
                style={styles.currencySelector}
                activeOpacity={0.7}
              >
                <Ionicons name="cash-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.currencySelectorText}>
                  {CURRENCIES.find(c => c.code === currency)?.name || 'دينار عراقي'}
                </Text>
                <Ionicons
                  name={showCurrencyPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {showCurrencyPicker && (
                <View style={styles.currencyDropdown}>
                  {CURRENCIES.map((curr) => {
                    const isSelected = currency === curr.code;
                    return (
                      <TouchableOpacity
                        key={curr.code}
                        style={[
                          styles.currencyOption,
                          isSelected && styles.currencyOptionSelected,
                        ]}
                        onPress={() => {
                          setCurrency(curr.code);
                          setShowCurrencyPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.currencySymbol}>{curr.symbol}</Text>
                        <Text style={[
                          styles.currencyOptionText,
                          isSelected && styles.currencyOptionTextSelected,
                        ]}>
                          {curr.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>نوع الهدف</Text>
              <View style={styles.categoriesGrid}>
                {categories.map(([catKey, catInfo]) => {
                  const isSelected = category === catKey;
                  return (
                    <TouchableOpacity
                      key={catKey}
                      onPress={() => setCategory(catKey)}
                      activeOpacity={0.8}
                      style={[
                        styles.categoryCard,
                        isSelected && { borderColor: categoryColors[catKey][0], borderWidth: 2 }
                      ]}
                    >
                      <LinearGradient
                        colors={isSelected
                          ? categoryColors[catKey] as any
                          : [theme.colors.surfaceLight, theme.colors.surfaceLight] as any
                        }
                        style={styles.categoryCardGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons
                          name={isSelected
                            ? categoryIcons[catKey] as any
                            : `${categoryIcons[catKey]}-outline` as any
                          }
                          size={26}
                          color={isSelected ? '#FFF' : categoryColors[catKey][0]}
                        />
                        <Text style={[
                          styles.categoryCardLabel,
                          isSelected && styles.categoryCardLabelActive
                        ]}>
                          {catInfo.label}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Target Date */}
            <View style={styles.section}>
              <View style={styles.optionRow}>
                <View style={styles.optionInfo}>
                  <View style={styles.optionIconContainer}>
                    <Ionicons name="calendar" size={18} color={theme.colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.optionTitle}>تاريخ الهدف</Text>
                    <Text style={styles.optionSubtitle}>حدد موعد لتحقيق هدفك</Text>
                  </View>
                </View>
                <Switch
                  value={hasTargetDate}
                  onValueChange={setHasTargetDate}
                  trackColor={{ false: theme.colors.border, true: categoryColors[category][0] + '40' }}
                  thumbColor={hasTargetDate ? categoryColors[category][0] : '#FFF'}
                />
              </View>

              {hasTargetDate && (
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateSelector}
                >
                  <Ionicons name="calendar-outline" size={20} color={categoryColors[category][0]} />
                  <Text style={styles.dateValue}>
                    {targetDate
                      ? targetDate.toLocaleDateString('ar-IQ', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                      : 'اختر التاريخ'}
                  </Text>
                </TouchableOpacity>
              )}

              {showDatePicker && (
                <DateTimePicker
                  value={targetDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setTargetDate(selectedDate);
                    }
                  }}
                  minimumDate={new Date()}
                />
              )}
            </View>

            {/* Description */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.inputLabel}>وصف (اختياري)</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="أضف ملاحظات حول هدفك..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Completed Checkbox (only for editing) */}
            {editingGoal && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setCompleted(!completed)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={completed ? "checkbox" : "checkbox-outline"}
                    size={26}
                    color={completed ? categoryColors[category][0] : theme.colors.textSecondary}
                  />
                  <Text style={styles.checkboxLabel}>تم إنجاز الهدف</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Save Button */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.md }]}>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.saveButton}
              activeOpacity={0.8}
              disabled={!title || !targetAmount || loading}
            >
              <LinearGradient
                colors={
                  title && targetAmount && !loading
                    ? categoryColors[category] as any
                    : ['#9CA3AF', '#6B7280']
                }
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  {loading ? 'جاري الحفظ...' : editingGoal ? 'تحديث الهدف' : 'حفظ الهدف'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
  },
  inputCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('sm'),
  },
  inputHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  textInput: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    padding: theme.spacing.md,
    textAlign: isRTL ? 'right' : 'left',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  amountCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...getPlatformShadow('md'),
  },
  amountHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  amountIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  amountInputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  currencyLabel: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: theme.spacing.sm,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontStyle: 'italic',
  },
  currentAmountRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  currentAmountLabel: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  currentAmountInput: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  currentAmountTextInput: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    minWidth: 60,
    textAlign: 'center',
  },
  currentAmountCurrency: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    marginLeft: theme.spacing.xs,
  },
  currencySelector: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
  },
  currencySelectorText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  currencyDropdown: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.sm,
    ...getPlatformShadow('sm'),
  },
  currencyOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 10,
    gap: theme.spacing.md,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    width: 36,
    textAlign: 'center',
  },
  currencyOptionText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  currencyOptionTextSelected: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    textAlign: isRTL ? 'right' : 'left',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryCard: {
    width: '23%',
    borderRadius: 14,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  categoryCardGradient: {
    padding: theme.spacing.sm,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  categoryCardLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  categoryCardLabelActive: {
    color: '#FFFFFF',
  },
  optionRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceCard,
    padding: theme.spacing.md,
    borderRadius: 16,
    ...getPlatformShadow('sm'),
  },
  optionInfo: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  optionSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
  },
  dateSelector: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.md,
    borderRadius: 12,
    marginTop: theme.spacing.md,
  },
  dateValue: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  checkboxContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    padding: theme.spacing.md,
    borderRadius: 16,
    gap: theme.spacing.md,
    ...getPlatformShadow('sm'),
  },
  checkboxLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...getPlatformShadow('md'),
  },
  saveButtonGradient: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  saveButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: '#FFFFFF',
    fontFamily: theme.typography.fontFamily,
  },
});
