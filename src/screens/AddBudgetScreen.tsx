import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Keyboard, TextInput, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getPlatformFontWeight, getPlatformShadow, type AppTheme } from '../utils/theme-constants';
import { useAppTheme, useThemedStyles } from '../utils/theme-context';
import { Budget, getCustomCategories, addBudget, updateBudget } from '../database/database';
import { EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { ScreenContainer, AppHeader, AppButton } from '../design-system';
import { CurrencyPickerModal } from '../components/CurrencyPickerModal';

// Category icons mapping
import { getCurrencyDisplayName, tl, useLocalization } from "../localization";
const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant',
  transport: 'car',
  shopping: 'cart',
  bills: 'receipt',
  health: 'medical',
  education: 'school',
  entertainment: 'game-controller',
  other: 'ellipsis-horizontal'
};
interface AddBudgetScreenProps {
  navigation: any;
  route: any;
}
export const AddBudgetScreen: React.FC<AddBudgetScreenProps> = ({
  navigation,
  route
}) => {
  useLocalization();
  const {
    theme
  } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const {
    currencyCode,
    formatCurrency
  } = useCurrency();
  const editingBudget = route?.params?.budget as Budget | undefined;
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const amountInputRef = React.useRef<any>(null);
  useEffect(() => {
    loadCustomCategories();
    if (editingBudget) {
      setAmount(formatNumberWithCommas(editingBudget.amount));
      setSelectedCategory(editingBudget.category);
      setCurrency((editingBudget as any).currency || currencyCode);
    } else {
      resetForm();
      // Small delay for focus on Android is often more stable
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 300);
    }
  }, [editingBudget, currencyCode]);
  useEffect(() => {
    setCurrency(currencyCode);
  }, [currencyCode]);

  // Convert amount when it changes
  useEffect(() => {
    const convertAmount = async () => {
      const cleanAmount = amount.replace(/,/g, '');
      if (cleanAmount && !isNaN(Number(cleanAmount)) && Number(cleanAmount) > 0) {
        if (currency !== currencyCode) {
          const converted = await convertCurrency(Number(cleanAmount), currency, currencyCode);
          setConvertedAmount(converted);
        } else {
          setConvertedAmount(null);
        }
      } else {
        setConvertedAmount(null);
      }
    };
    convertAmount();
  }, [amount, currency, currencyCode]);
  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {}
  };
  const resetForm = () => {
    setAmount('');
    setSelectedCategory('');
    setCurrency(currencyCode);
  };
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);
  const handleSave = async () => {
    Keyboard.dismiss();
    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount.trim()) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مبلغ الميزانية"));
      return;
    }
    if (isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      alertService.warning(tl("تنبيه"), tl("يرجى إدخال مبلغ صحيح"));
      return;
    }
    if (!selectedCategory) {
      alertService.warning(tl("تنبيه"), tl("يرجى اختيار فئة للميزانية"));
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      if (editingBudget) {
        await updateBudget(editingBudget.id, {
          category: selectedCategory,
          amount: parseFloat(cleanAmount),
          month,
          year,
          currency: currency
        });
        alertService.toastSuccess(tl("تم تحديث الميزانية بنجاح"));
      } else {
        await addBudget({
          category: selectedCategory,
          amount: parseFloat(cleanAmount),
          month,
          year,
          currency: currency
        });
        alertService.toastSuccess(tl("تم إضافة الميزانية بنجاح"));
      }
      handleClose();
    } catch (error) {
      alertService.error(tl("خطأ"), tl("حدث خطأ أثناء حفظ الميزانية"));
    } finally {
      setLoading(false);
    }
  };
  const getCategoryName = (category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || customCategories.find(c => c.name === category)?.name || category;
  };
  const getCategoryIcon = (category: string) => {
    const customCat = customCategories.find(c => c.name === category);
    if (customCat?.icon) return customCat.icon;
    return CATEGORY_ICONS[category] || 'wallet';
  };
  const allCategories = [...Object.keys(EXPENSE_CATEGORIES), ...customCategories.map(c => c.name)];
  const saveFooter = <AppButton label={loading ? tl("جاري الحفظ...") : editingBudget ? tl("تحديث الميزانية") : tl("حفظ الميزانية")} onPress={handleSave} variant="primary" size="lg" loading={loading} disabled={!amount || !selectedCategory || loading} leftIcon="checkmark-circle" />;
  return <ScreenContainer scrollable edges={['bottom', 'left', 'right']} scrollPadBottom={32} style={{
    backgroundColor: theme.colors.surfaceCard
  }}>
      {/* Header */}
      <AppHeader title={editingBudget ? tl("تعديل الميزانية") : tl("إضافة ميزانية جديدة")} onBack={handleClose} backIcon={isRTL ? 'chevron-back' : 'chevron-forward'} />

      {/* Amount Card */}
      <View style={styles.amountCard}>
        <View style={styles.amountHeader}>
          <View style={styles.amountIconBg}>
            <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
          </View>
          <Text style={styles.amountLabel}>{tl("المبلغ الشهري")}</Text>
        </View>

        <View style={styles.amountInputContainer}>
          <TextInput ref={amountInputRef} style={styles.amountInput} value={amount} onChangeText={val => {
          const cleaned = convertArabicToEnglish(val);
          setAmount(formatNumberWithCommas(cleaned));
        }} placeholder="0" placeholderTextColor={theme.colors.textMuted} keyboardType="decimal-pad" />
          <Text style={styles.currencyLabel}>
            {CURRENCIES.find(c => c.code === currency)?.symbol || tl("د.ع")}
          </Text>
        </View>

        <View style={{
        height: 24,
        justifyContent: 'center'
      }}>
          {convertedAmount !== null && currency !== currencyCode && <Text style={styles.convertedAmountText}>
              ≈ {formatCurrency(convertedAmount)}
            </Text>}
        </View>

        {/* Currency Selection */}
        <View style={styles.currencySection}>
          <View style={styles.currencyHeader}>
            <Ionicons name="cash-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.currencyLabelSmall}>{tl("العملة")}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCurrencyPicker(true)}
            activeOpacity={0.7}
            style={styles.currencySelector}
          >
            <View style={styles.currencySelectorContent}>
              <Text style={styles.currencySelectorText}>
                {getCurrencyDisplayName(currency)}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{tl("اختر الفئة")}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
          style={[styles.categoriesScrollView, isRTL && { transform: [{ scaleX: -1 }] }]}
        >
          {allCategories.map(category => {
            const isSelected = selectedCategory === category;
            const customCat = customCategories.find(c => c.name === category);
            const categoryColor = customCat?.color || theme.colors.primary;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                activeOpacity={0.7}
                style={[
                  styles.categoryCard,
                  isSelected && { backgroundColor: categoryColor },
                  isRTL && { transform: [{ scaleX: -1 }] }
                ]}
              >
                <View style={[styles.categoryIconContainer, isSelected && { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                  <Ionicons
                    name={(isSelected ? getCategoryIcon(category) : `${getCategoryIcon(category)}-outline`) as any}
                    size={20}
                    color={isSelected ? '#FFFFFF' : categoryColor}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryCardLabel,
                    isSelected && styles.categoryCardLabelActive
                  ]}
                >
                  {tl(getCategoryName(category))}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
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
  amountCard: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: 20,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('md')
  },
  amountHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  amountIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  amountLabel: {
    fontSize: theme.typography.sizes.lg,
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
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  currencyLabel: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    marginHorizontal: theme.spacing.sm
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    fontStyle: 'italic'
  },
  currencySection: {
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  currencyHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  currencyLabelSmall: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('600'),
  },
  currencySelector: {
    backgroundColor: theme.colors.surfaceLight,
    borderRadius: 12,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  currencySelectorContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencySelectorText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    fontWeight: getPlatformFontWeight('700'),
  },
  currencyDropdown: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing.sm,
    ...getPlatformShadow('sm')
  },
  currencyOption: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 10,
    gap: theme.spacing.md
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    width: 36,
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
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md, // Add padding to align with label
    textAlign: isRTL ? 'right' : 'left'
  },
  categoriesScrollView: {
    marginBottom: theme.spacing.sm,
  },
  categoriesRow: {
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryCard: {
    width: 100, // Slightly larger
    height: 90, // Slightly larger
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    ...getPlatformShadow('sm')
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  categoryCardLabel: {
    fontSize: 12, // More compact
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center'
  },
  categoryCardLabelActive: {
    color: '#FFFFFF'
  }
});
