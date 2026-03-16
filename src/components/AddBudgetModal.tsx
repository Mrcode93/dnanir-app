import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, getPlatformFontWeight, getPlatformShadow, useAppTheme, useThemedStyles } from '../utils/theme';
import { Budget, getCustomCategories, addBudget, updateBudget } from '../database/database';
import { EXPENSE_CATEGORIES, CURRENCIES } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { isRTL } from '../utils/rtl';
import { convertCurrency } from '../services/currencyService';
import { alertService } from '../services/alertService';
import { convertArabicToEnglish, formatNumberWithCommas } from '../utils/numbers';
import { AppBottomSheet, AppButton } from '../design-system';
import { CurrencyPickerModal } from './CurrencyPickerModal';

interface AddBudgetModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  budget?: Budget | null;
}

// Category icons mapping
const CATEGORY_ICONS: Record<string, string> = {
  food: 'restaurant',
  transport: 'car',
  shopping: 'cart',
  bills: 'receipt',
  health: 'medical',
  education: 'school',
  entertainment: 'game-controller',
  other: 'ellipsis-horizontal',
};

export const AddBudgetModal: React.FC<AddBudgetModalProps> = ({
  visible,
  onClose,
  onSave,
  budget,
}) => {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { currencyCode, formatCurrency } = useCurrency();
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currency, setCurrency] = useState<string>(currencyCode);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  useEffect(() => {
    loadCustomCategories();
  }, []);

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

  useEffect(() => {
    if (visible) {
      if (budget) {
        setAmount(formatNumberWithCommas(budget.amount));
        setSelectedCategory(budget.category);
        setCurrency((budget as any).currency || currencyCode);
      } else {
        setAmount('');
        setSelectedCategory('');
        setCurrency(currencyCode);
      }
    }
  }, [visible, budget, currencyCode]);

  const loadCustomCategories = async () => {
    try {
      const categories = await getCustomCategories('expense');
      setCustomCategories(categories);
    } catch (error) {

    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();

    const cleanAmount = amount.replace(/,/g, '');
    if (!cleanAmount.trim()) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ الميزانية');
      return;
    }

    if (isNaN(Number(cleanAmount)) || Number(cleanAmount) <= 0) {
      alertService.warning('تنبيه', 'يرجى إدخال مبلغ صحيح');
      return;
    }

    if (!selectedCategory) {
      alertService.warning('تنبيه', 'يرجى اختيار فئة للميزانية');
      return;
    }

    try {
      const now = new Date();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();

      if (budget) {
        await updateBudget(budget.id, {
          category: selectedCategory,
          amount: parseFloat(cleanAmount),
          month,
          year,
          currency: currency,
        });
        alertService.toastSuccess('تم تحديث الميزانية بنجاح');
      } else {
        await addBudget({
          category: selectedCategory,
          amount: parseFloat(cleanAmount),
          month,
          year,
          currency: currency,
        });
        alertService.toastSuccess('تم إضافة الميزانية بنجاح');
      }

      onSave();
      onClose();
    } catch (error) {

      alertService.error('خطأ', 'حدث خطأ أثناء حفظ الميزانية');
    }
  };

  const getCategoryName = (category: string) => {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] ||
      customCategories.find(c => c.name === category)?.name ||
      category;
  };

  const getCategoryIcon = (category: string) => {
    const customCat = customCategories.find(c => c.name === category);
    if (customCat?.icon) return customCat.icon;
    return CATEGORY_ICONS[category] || 'wallet';
  };

  const allCategories = [
    ...Object.keys(EXPENSE_CATEGORIES),
    ...customCategories.map(c => c.name),
  ];

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      title={budget ? 'تعديل الميزانية' : 'إضافة ميزانية جديدة'}
      maxHeight="90%"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>المبلغ الشهري</Text>
          <View style={styles.amountInputRow}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(val) => {
                const cleaned = convertArabicToEnglish(val);
                setAmount(formatNumberWithCommas(cleaned));
              }}
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="numeric"
              autoFocus
            />
            <AppButton
              label={CURRENCIES.find(c => c.code === currency)?.symbol || ''}
              onPress={() => setShowCurrencyPicker(true)}
              variant="secondary"
              rightIcon="chevron-down"
              style={styles.currencyButton}
              labelStyle={styles.currencyText}
            />
          </View>
          {convertedAmount !== null && currency !== currencyCode && (
            <Text style={styles.convertedAmountText}>
              ≈ {formatCurrency(convertedAmount)}
            </Text>
          )}
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>اختر الفئة</Text>
          <View style={styles.categoriesGrid}>
            {allCategories.map((category) => {
              const isSelected = selectedCategory === category;
              const customCat = customCategories.find(c => c.name === category);
              const categoryColor = customCat?.color || theme.colors.primary;

              return (
                <AppButton
                  key={category}
                  label={getCategoryName(category)}
                  onPress={() => setSelectedCategory(category)}
                  variant={isSelected ? 'primary' : 'secondary'}
                  leftIcon={isSelected ? (getCategoryIcon(category) as any) : (`${getCategoryIcon(category)}-outline` as any)}
                  style={[
                    styles.categoryCard,
                    isSelected && { backgroundColor: categoryColor }
                  ]}
                  labelStyle={[
                    styles.categoryCardLabel,
                    isSelected && styles.categoryCardLabelActive
                  ]}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <AppButton
          label="إلغاء"
          onPress={onClose}
          variant="secondary"
          style={styles.cancelButton}
        />
        <AppButton
          label={budget ? 'تحديث' : 'حفظ الميزانية'}
          onPress={handleSave}
          variant="primary"
          disabled={!amount || !selectedCategory}
          leftIcon="checkmark"
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
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  amountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...getPlatformShadow('sm'),
  },
  amountLabel: {
    fontSize: theme.typography.sizes.md,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  amountInputRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    minWidth: 120,
  },
  currencyButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 12,
    gap: 4,
  },
  currencyText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
  },
  convertedAmountText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.md,
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
    width: '31%',
    borderRadius: 16,
    overflow: 'hidden',
    ...getPlatformShadow('sm'),
  },
  categoryCardGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
    minHeight: 90,
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryCardLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: getPlatformFontWeight('600'),
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'center',
  },
  categoryCardLabelActive: {
    color: theme.colors.background,
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  actions: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },

  // Currency Modal Styles
  currencyModalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  currencyModalContainer: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    ...getPlatformShadow('lg'),
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
    fontSize: theme.typography.sizes.lg,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
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
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceLight,
  },
  currencyOptionSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  currencyOptionContent: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  currencySymbol: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily,
    width: 40,
    textAlign: 'center',
    ...(isRTL ? { marginLeft: theme.spacing.md } : { marginRight: theme.spacing.md }),
  },
  currencyOptionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.fontFamily,
    textAlign: isRTL ? 'right' : 'left',
  },
  currencyOptionTextSelected: {
    fontWeight: getPlatformFontWeight('700'),
    color: theme.colors.primary,
  },
});
