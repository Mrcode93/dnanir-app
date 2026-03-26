import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Keyboard, TextInput, Switch, ScrollView } from 'react-native';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { addFinancialGoal, updateFinancialGoal } from '../database/database';
import { FinancialGoal, GoalCategory, GOAL_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { Platform } from 'react-native';
import { ScreenContainer, AppHeader, AppButton } from '../design-system';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';
import { getCurrencyDisplayName, tl, useLocalization } from "../localization";
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
  other: 'star'
};
const categoryColors: Record<GoalCategory, string[]> = {
  emergency: ['#EF4444', '#DC2626'],
  vacation: ['#8B5CF6', '#7C3AED'],
  car: ['#10B981', '#059669'],
  house: ['#3B82F6', '#2563EB'],
  wedding: ['#EC4899', '#DB2777'],
  education: ['#06B6D4', '#0891B2'],
  business: ['#F59E0B', '#D97706'],
  other: ['#6B7280', '#4B5563']
};
export const AddGoalScreen: React.FC<AddGoalScreenProps> = ({
  navigation,
  route
}) => {
  const {
    language
  } = useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    currencyCode,
    formatCurrency
  } = useCurrency();
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  useEffect(() => {
    if (route.params?.goal) {
      setEditingGoal(route.params.goal);
    }
  }, [route.params?.goal]);
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, []);
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
  const [isInitialized, setIsInitialized] = useState(false);
  const amountInputRef = useRef<TextInput>(null);
  const currentAmountInputRef = useRef<TextInput>(null);
  const [convertedTargetAmount, setConvertedTargetAmount] = useState<number | null>(null);
  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setTargetAmount(formatNumberWithCommas(editingGoal.targetAmount));
      setCurrentAmount(formatNumberWithCommas(editingGoal.currentAmount));
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
      const cleanTargetAmount = targetAmount.replace(/,/g, '');
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
    const cleanTargetAmount = targetAmount.replace(/,/g, '');
    const cleanCurrentAmount = currentAmount.replace(/,/g, '');
    if (!title.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال عنوان الهدف"));
      return;
    }
    if (!cleanTargetAmount.trim() || isNaN(Number(cleanTargetAmount)) || Number(cleanTargetAmount) <= 0) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مبلغ مستهدف صحيح"));
      return;
    }
    setLoading(true);
    try {
      const goalData = {
        title: title.trim(),
        targetAmount: parseFloat(cleanTargetAmount),
        currentAmount: parseFloat(cleanCurrentAmount) || 0,
        targetDate: hasTargetDate && targetDate ? targetDate.toISOString().split('T')[0] : undefined,
        category,
        description: description.trim() || undefined,
        completed,
        currency
      };
      if (editingGoal) {
        await updateFinancialGoal(editingGoal.id, goalData);
        alertService.toastSuccess(tl("تم تحديث الهدف بنجاح"));
      } else {
        await addFinancialGoal(goalData);
        alertService.toastSuccess(tl("تم إضافة الهدف بنجاح"));
      }
      handleClose();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حفظ الهدف"));
    } finally {
      setLoading(false);
    }
  };
  const categories = Object.entries(GOAL_CATEGORIES) as [GoalCategory, {
    label: string;
    icon: string;
  }][];
  const saveFooter = <AppButton label={loading ? tl("جاري الحفظ...") : editingGoal ? tl("تحديث الهدف") : tl("حفظ الهدف")} onPress={handleSave} variant="primary" size="lg" loading={loading} disabled={!title || !targetAmount || loading} leftIcon="checkmark-circle" style={{
    backgroundColor: categoryColors[category][0]
  }} />;
  return <ScreenContainer scrollable edges={['bottom', 'left', 'right']} scrollPadBottom={32} style={{
    backgroundColor: theme.colors.surfaceCard
  }}>
      {/* Header */}
      <AppHeader title={editingGoal ? tl("تعديل الهدف") : tl("إضافة هدف جديد")} onBack={handleClose} backIcon={isRTL ? 'chevron-back' : 'chevron-forward'} action={<View style={[styles.headerIcon, {
      backgroundColor: categoryColors[category][0] + '20'
    }]}>
            <Ionicons name={categoryIcons[category] as any} size={24} color={categoryColors[category][0]} />
          </View>} />

      {/* Title Input */}
      <View style={styles.inputCard}>
        <View style={styles.inputHeader}>
          <Ionicons name="bookmark-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.inputLabel}>{tl("عنوان الهدف")}</Text>
        </View>
        <TextInput style={styles.textInput} value={title} onChangeText={setTitle} placeholder={tl("مثال: توفير لسيارة جديدة")} placeholderTextColor={theme.colors.textMuted} />
      </View>

      {/* Amount Card */}
      <View style={styles.amountCard}>
        <View style={styles.amountHeader}>
          <View style={styles.amountIconBg}>
            <Ionicons name="flag-outline" size={24} color={categoryColors[category][0]} />
          </View>
          <Text style={styles.amountLabel}>{tl("المبلغ المستهدف")}</Text>
        </View>

        <View style={styles.amountInputContainer}>
          <TextInput ref={amountInputRef} style={styles.amountInput} value={targetAmount} onChangeText={val => {
          const cleaned = convertArabicToEnglish(val);
          setTargetAmount(formatNumberWithCommas(cleaned));
        }} placeholder="0" placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />
        <Text style={[styles.currencyLabel, {
          color: categoryColors[category][0]
        }]}>
            {CURRENCIES.find(c => c.code === currency)?.symbol || tl("د.ع")}
          </Text>
        </View>

        {convertedTargetAmount !== null && currency !== currencyCode && <Text style={styles.convertedAmountText}>
            ≈ {formatCurrency(convertedTargetAmount)}
          </Text>}

        {/* Current Amount */}
        <View style={styles.currentAmountRow}>
          <Text style={styles.currentAmountLabel}>{tl("المبلغ الحالي:")}</Text>
          <View style={styles.currentAmountInput}>
            <TextInput ref={currentAmountInputRef} style={styles.currentAmountTextInput} value={currentAmount} onChangeText={val => {
            const cleaned = convertArabicToEnglish(val);
            setCurrentAmount(formatNumberWithCommas(cleaned));
          }} placeholder="0" placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />
            <Text style={styles.currentAmountCurrency}>
              {CURRENCIES.find(c => c.code === currency)?.symbol}
            </Text>
          </View>
        </View>

        {/* Currency Selection */}
        <AppButton label={getCurrencyDisplayName(currency)} onPress={() => setShowCurrencyPicker(true)} variant="secondary" leftIcon="cash-outline" rightIcon="chevron-down" style={styles.currencySelector} labelStyle={styles.currencySelectorText} />
      </View>

      {/* Category Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{tl("نوع الهدف")}</Text>
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
            style={[styles.categoriesScrollView, isRTL && { transform: [{ scaleX: -1 }] }]}
          >
            {categories.map(([catKey, catInfo]) => {
              const isSelected = category === catKey;
              return (
                <TouchableOpacity
                  key={catKey}
                  onPress={() => setCategory(catKey)}
                  activeOpacity={0.7}
                  style={[
                    styles.categoryCard,
                    isSelected && { backgroundColor: categoryColors[catKey][0] },
                    isRTL && { transform: [{ scaleX: -1 }] }
                  ]}
                >
                  <Ionicons
                    name={(isSelected ? categoryIcons[catKey] : `${categoryIcons[catKey]}-outline`) as any}
                    size={20}
                    color={isSelected ? '#FFFFFF' : categoryColors[catKey][0]}
                  />
                  <Text
                    style={[
                      styles.categoryCardLabel,
                      isSelected && styles.categoryCardLabelActive
                    ]}
                  >
                    {tl(catInfo.label)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
              <Text style={styles.optionTitle}>{tl("تاريخ الهدف")}</Text>
              <Text style={styles.optionSubtitle}>{tl("حدد موعد لتحقيق هدفك")}</Text>
            </View>
          </View>
          <Switch value={hasTargetDate} onValueChange={setHasTargetDate} trackColor={{
          false: '#767577',
          true: categoryColors[category][0]
        }} thumbColor={hasTargetDate ? '#FFFFFF' : '#f4f3f4'} />
        </View>

        {hasTargetDate && <AppButton label={targetDate ? targetDate.toLocaleDateString(language === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
      }) : tl("اختر التاريخ")} onPress={() => setShowDatePicker(true)} variant="secondary" leftIcon="calendar-outline" style={styles.dateSelector} labelStyle={styles.dateValue} />}

        {showDatePicker && <CustomDatePicker value={targetDate || new Date()} onChange={(event, selectedDate) => {
        if (selectedDate) {
          setTargetDate(selectedDate);
        }
        if (Platform.OS === 'android') setShowDatePicker(false);
      }} onClose={() => setShowDatePicker(false)} minimumDate={new Date()} />}
      </View>

      {/* Description */}
      <View style={styles.inputCard}>
        <View style={styles.inputHeader}>
          <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.inputLabel}>{tl("وصف (اختياري)")}</Text>
        </View>
        <TextInput style={[styles.textInput, styles.textArea]} value={description} onChangeText={setDescription} placeholder={tl("أضف ملاحظات حول هدفك...")} placeholderTextColor={theme.colors.textMuted} multiline numberOfLines={3} />
      </View>

      {/* Completed Checkbox (only for editing) */}
      {editingGoal && <View style={styles.section}>
          <TouchableOpacity style={styles.checkboxContainer} onPress={() => setCompleted(!completed)} activeOpacity={0.7}>
            <Ionicons name={completed ? "checkbox" : "checkbox-outline"} size={26} color={completed ? categoryColors[category][0] : theme.colors.textSecondary} />
            <Text style={styles.checkboxLabel}>{tl("تم إنجاز الهدف")}</Text>
          </TouchableOpacity>
        </View>}
      {/* Save Button */}
      <View style={{
      paddingHorizontal: 16,
      marginTop: 12,
      marginBottom: 20
    }}>
        {saveFooter}
      </View>

      <CurrencyPickerModal visible={showCurrencyPicker} selectedCurrency={currency} onSelect={code => {
      setCurrency(code);
      setShowCurrencyPicker(false);
    }} onClose={() => setShowCurrencyPicker(false)} />
    </ScreenContainer>;
};
const createStyles = (theme: AppTheme) => StyleSheet.create({
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    ...getPlatformShadow('sm')
  },
  inputHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  inputLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  textInput: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    padding: 10,
    textAlign: isRTL ? 'right' : 'left'
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top'
  },
  amountCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    padding: 10,
    marginBottom: 10,
    ...getPlatformShadow('md')
  },
  amountHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  amountIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  amountLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  amountInputContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 16,
    padding: 10,
    marginBottom: 10
  },
  amountInput: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  currencyLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: 10
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic'
  },
  currentAmountRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  currentAmountLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  currentAmountInput: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  currentAmountTextInput: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    minWidth: 60,
    textAlign: 'center'
  },
  currentAmountCurrency: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    marginLeft: theme.spacing.xs
  },
  currencySelector: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    // Reduced vertical padding
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12
  },
  currencySelectorText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 22,
    // Add line height to prevent clipping
    paddingBottom: Platform.OS === 'ios' ? 2 : 0 // Extra space for Arabic fonts on iOS
  },
  currencyDropdown: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 10,
    ...getPlatformShadow('sm')
  },
  currencyOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 10
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    width: 40,
    textAlign: 'center'
  },
  currencyOptionText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  currencyOptionTextSelected: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary
  },
  section: {
    marginBottom: theme.spacing.md
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: 10,
    paddingHorizontal: 16,
    textAlign: isRTL ? 'right' : 'left'
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  categoriesScrollView: {
    // No horizontal margin/padding on the ScrollView itself to allow it to clip correctly
    marginBottom: 8,
  },
  categoriesRow: {
    paddingHorizontal: 16,
    flexDirection: 'row', // ScaleX handles order
    gap: 12,
    paddingVertical: 4,
  },
  categoryCard: {
    width: 90,
    height: 75, // Slightly larger for better touch area with padding
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...getPlatformShadow('sm')
  },
  categoryCardGradient: {
    padding: 10,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center'
  },
  categoryCardLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginTop: 5
  },
  categoryCardLabelActive: {
    color: theme.colors.background
  },
  optionRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceCard,
    padding: theme.spacing.md,
    borderRadius: 16,
    ...getPlatformShadow('sm')
  },
  optionInfo: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  },
  optionSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily
  },
  dateSelector: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceLight,
    padding: theme.spacing.md,
    borderRadius: 12,
    marginTop: theme.spacing.md
  },
  dateValue: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left'
  },
  checkboxContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard,
    padding: theme.spacing.md,
    borderRadius: 16,
    gap: theme.spacing.md,
    ...getPlatformShadow('sm')
  },
  checkboxLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily
  }
});
